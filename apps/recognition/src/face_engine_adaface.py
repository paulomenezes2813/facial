"""Engine baseado em AdaFace + MediaPipe BlazeFace.

Vantagens vs InsightFace:
- Licença comercial limpa: AdaFace é MIT, MediaPipe é Apache 2.0.
- Acurácia melhor em rostos de baixa qualidade (típico de webcam de totem).

Pré-requisitos:
- Modelo ONNX do AdaFace em settings.adaface_model_path.
  Use `python -m apps.recognition.scripts.setup_adaface` para baixar/converter.

Pipeline:
1. MediaPipe BlazeFace detecta rosto + 6 keypoints (eye-L, eye-R, nose, mouth, ear-L, ear-R).
2. Constrói os 5 landmarks padrão (olhos, nariz, cantos da boca aproximados).
3. Similarity transform → align em 112x112 (formato esperado pelo AdaFace).
4. Normaliza pixels [-1, 1] e roda AdaFace ONNX.
5. L2-normaliza o embedding 512-d (pra cosine = dot product no Qdrant).
"""
from __future__ import annotations

import base64
import io
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from loguru import logger
from PIL import Image

from .config import settings
from .face_engine_protocol import FaceData

# Pontos canônicos do template ArcFace/AdaFace 112x112 (padrão da literatura).
# Olho-E, Olho-D, Nariz, Boca-E, Boca-D
_ARCFACE_TEMPLATE = np.array(
    [
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ],
    dtype=np.float32,
)


class _BlazeFaceDetector:
    """Wrapper sobre o detector de face do MediaPipe (BlazeFace, Apache 2.0).

    Devolve bbox + 6 keypoints por rosto.
    """

    def __init__(self) -> None:
        # Import tardio: mediapipe é pesado no boot.
        import mediapipe as mp

        self._mp = mp
        self.detector = mp.solutions.face_detection.FaceDetection(
            model_selection=1,  # 1 = full-range, melhor pra distâncias variadas em totem
            min_detection_confidence=0.5,
        )

    def detect(self, image_bgr: np.ndarray) -> list[dict]:
        h, w = image_bgr.shape[:2]
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        result = self.detector.process(rgb)
        if not result.detections:
            return []

        out: list[dict] = []
        for det in result.detections:
            box = det.location_data.relative_bounding_box
            x1 = max(0, int(box.xmin * w))
            y1 = max(0, int(box.ymin * h))
            x2 = min(w, int((box.xmin + box.width) * w))
            y2 = min(h, int((box.ymin + box.height) * h))
            score = float(det.score[0]) if det.score else 0.0

            kps = det.location_data.relative_keypoints
            # MediaPipe ordem: 0=right_eye, 1=left_eye, 2=nose_tip, 3=mouth_center, 4=right_ear, 5=left_ear
            # AdaFace espera: olho-E, olho-D, nariz, boca-E, boca-D (perspectiva da pessoa).
            right_eye = (kps[0].x * w, kps[0].y * h)
            left_eye = (kps[1].x * w, kps[1].y * h)
            nose = (kps[2].x * w, kps[2].y * h)
            mouth = (kps[3].x * w, kps[3].y * h)

            # Aproximação dos cantos da boca a partir do centro: deslocamento horizontal
            # proporcional à distância entre os olhos (~30%).
            eye_dist = np.linalg.norm(np.array(right_eye) - np.array(left_eye))
            mouth_offset = eye_dist * 0.30
            mouth_left = (mouth[0] - mouth_offset, mouth[1])
            mouth_right = (mouth[0] + mouth_offset, mouth[1])

            landmarks5 = np.array(
                [left_eye, right_eye, nose, mouth_left, mouth_right],
                dtype=np.float32,
            )
            out.append(
                {
                    "bbox": (x1, y1, x2, y2),
                    "score": score,
                    "landmarks5": landmarks5,
                }
            )
        return out


def _align_face(image_bgr: np.ndarray, landmarks5: np.ndarray) -> np.ndarray:
    """Alinha o rosto pra 112x112 via similarity transform (mesmo do ArcFace)."""
    M, _ = cv2.estimateAffinePartial2D(landmarks5, _ARCFACE_TEMPLATE, method=cv2.LMEDS)
    if M is None:
        # Fallback: retângulo central. Pior, mas evita crash.
        return cv2.resize(image_bgr, (112, 112))
    return cv2.warpAffine(image_bgr, M, (112, 112), borderValue=0.0)


class AdaFaceEngine:
    """Singleton lazy-loaded com AdaFace ONNX + MediaPipe BlazeFace."""

    _instance: "AdaFaceEngine | None" = None

    def __init__(self) -> None:
        model_path = Path(settings.adaface_model_path)
        if not model_path.exists():
            raise RuntimeError(
                f"Modelo AdaFace ONNX não encontrado em {model_path}. "
                "Rode: python -m apps.recognition.scripts.setup_adaface"
            )

        logger.info(f"Carregando AdaFace ONNX de {model_path}")

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if settings.insightface_ctx_id >= 0
            else ["CPUExecutionProvider"]
        )
        self.session = ort.InferenceSession(str(model_path), providers=providers)
        self.input_name = self.session.get_inputs()[0].name

        logger.info("Carregando detector MediaPipe BlazeFace...")
        self.detector = _BlazeFaceDetector()
        logger.info("AdaFace pronto.")

    @classmethod
    def get(cls) -> "AdaFaceEngine":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @staticmethod
    def decode_base64_image(b64: str) -> np.ndarray:
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        raw = base64.b64decode(b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        arr = np.array(img)
        return arr[:, :, ::-1].copy()  # RGB -> BGR

    def _embed(self, aligned_bgr_112: np.ndarray) -> np.ndarray:
        """Roda AdaFace e devolve embedding 512-d L2-normalizado."""
        # AdaFace foi treinado com BGR e normalização [-1, 1] (conforme repo oficial).
        x = aligned_bgr_112.astype(np.float32)
        x = (x - 127.5) / 127.5  # [-1, 1]
        # NCHW
        x = np.transpose(x, (2, 0, 1))[None, ...]  # (1, 3, 112, 112)
        out = self.session.run(None, {self.input_name: x})
        emb = np.array(out[0]).reshape(-1).astype(np.float32)
        # L2-normalize (pra cosine = dot)
        norm = np.linalg.norm(emb) + 1e-9
        return emb / norm

    def analyze(self, image_bgr: np.ndarray) -> list[FaceData]:
        detections = self.detector.detect(image_bgr)
        results: list[FaceData] = []
        for det in detections:
            aligned = _align_face(image_bgr, det["landmarks5"])
            emb = self._embed(aligned)
            results.append(
                FaceData(
                    embedding=emb,
                    bbox=det["bbox"],
                    det_score=det["score"],
                )
            )
        return results

    @staticmethod
    def crop_face_base64_jpeg(
        image_bgr: np.ndarray,
        bbox: tuple[int, int, int, int],
        *,
        margin_ratio: float = 0.25,
        max_size: int = 512,
        quality: int = 85,
    ) -> str:
        h, w = image_bgr.shape[:2]
        x1, y1, x2, y2 = bbox
        bw = max(1, x2 - x1)
        bh = max(1, y2 - y1)
        mx = int(bw * margin_ratio)
        my = int(bh * margin_ratio)

        cx1 = max(0, x1 - mx)
        cy1 = max(0, y1 - my)
        cx2 = min(w, x2 + mx)
        cy2 = min(h, y2 + my)

        crop_bgr = image_bgr[cy1:cy2, cx1:cx2]
        crop_rgb = crop_bgr[:, :, ::-1]
        img = Image.fromarray(crop_rgb)

        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size))

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        return base64.b64encode(buf.getvalue()).decode("ascii")

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b))
