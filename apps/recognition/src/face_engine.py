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
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """Embeddings já vêm normalizados, então cosine = dot product."""
        return float(np.dot(a, b))
