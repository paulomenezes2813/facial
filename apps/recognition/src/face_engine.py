"""Wrapper sobre o InsightFace (Buffalo_L = SCRFD + ArcFace R100)."""
from __future__ import annotations

import base64
import io
from dataclasses import dataclass

import numpy as np
from insightface.app import FaceAnalysis
from loguru import logger
from PIL import Image

from .config import settings


@dataclass
class FaceData:
    embedding: np.ndarray  # 512-dim normalizado
    bbox: tuple[int, int, int, int]
    det_score: float  # confiança da detecção (proxy de qualidade)
    age: float | None
    gender: int | None  # 0=F, 1=M


class FaceEngine:
    """Singleton lazy-loaded para o pipeline InsightFace."""

    _instance: "FaceEngine | None" = None

    def __init__(self) -> None:
        logger.info(
            f"Carregando InsightFace model={settings.insightface_model} "
            f"ctx_id={settings.insightface_ctx_id} det_size={settings.insightface_det_size}"
        )
        self.app = FaceAnalysis(name=settings.insightface_model)
        self.app.prepare(
            ctx_id=settings.insightface_ctx_id,
            det_size=(settings.insightface_det_size, settings.insightface_det_size),
        )
        logger.info("InsightFace pronto.")

    @classmethod
    def get(cls) -> "FaceEngine":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @staticmethod
    def decode_base64_image(b64: str) -> np.ndarray:
        """Decodifica imagem base64 → numpy BGR (formato esperado pelo InsightFace)."""
        if "," in b64:
            b64 = b64.split(",", 1)[1]  # remove prefixo data:
        raw = base64.b64decode(b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        arr = np.array(img)
        # PIL → BGR (InsightFace espera BGR como o OpenCV)
        return arr[:, :, ::-1].copy()

    def analyze(self, image_bgr: np.ndarray) -> list[FaceData]:
        """Detecta rostos e gera embeddings."""
        faces = self.app.get(image_bgr)
        result: list[FaceData] = []
        for f in faces:
            emb = f.normed_embedding  # já normalizado L2
            x1, y1, x2, y2 = map(int, f.bbox)
            result.append(
                FaceData(
                    embedding=emb.astype(np.float32),
                    bbox=(x1, y1, x2, y2),
                    det_score=float(f.det_score),
                    age=float(getattr(f, "age", 0)) or None,
                    gender=int(getattr(f, "gender", -1)) if hasattr(f, "gender") else None,
                )
            )
        return result

    @staticmethod
    def crop_face_base64_jpeg(
        image_bgr: np.ndarray,
        bbox: tuple[int, int, int, int],
        *,
        margin_ratio: float = 0.25,
        max_size: int = 512,
        quality: int = 85,
    ) -> str:
        """
        Recorta a região da face (com margem) e devolve JPEG em base64 (sem prefixo data:).
        Mantém a proporção e limita o tamanho máximo para padronizar armazenamento e inferência.
        """
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
        crop_rgb = crop_bgr[:, :, ::-1]  # BGR -> RGB
        img = Image.fromarray(crop_rgb)

        # Normaliza tamanho (mantém proporção)
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size))

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        return base64.b64encode(buf.getvalue()).decode("ascii")

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """Embeddings já vêm normalizados, então cosine = dot product."""
        return float(np.dot(a, b))
