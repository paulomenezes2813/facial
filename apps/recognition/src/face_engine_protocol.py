"""Interface comum aos engines de reconhecimento facial.

Permite plugar diferentes backends (InsightFace, AdaFace, etc.) sem mexer
no resto do microserviço (main.py, vector_store.py).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np


@dataclass
class FaceData:
    """Resultado padronizado de uma detecção + embedding.

    embedding: 512-d, L2-normalizado (norma = 1.0). Cosine similarity = dot product.
    bbox: (x1, y1, x2, y2) em pixels da imagem original.
    det_score: confiança da detecção [0, 1] — proxy de qualidade do recorte.
    age, gender: opcionais; alguns engines não fornecem.
    """

    embedding: np.ndarray
    bbox: tuple[int, int, int, int]
    det_score: float
    age: float | None = None
    gender: int | None = None  # 0=F, 1=M


class FaceEngineProtocol(Protocol):
    """Contrato mínimo que todo engine deve implementar.

    main.py e demais consumidores dependem APENAS desta interface.
    """

    @staticmethod
    def decode_base64_image(b64: str) -> np.ndarray:
        """Decodifica base64 (com ou sem prefixo data:) em ndarray BGR."""
        ...

    def analyze(self, image_bgr: np.ndarray) -> list[FaceData]:
        """Detecta rostos e devolve embedding 512-d L2-normalizado."""
        ...

    @staticmethod
    def crop_face_base64_jpeg(
        image_bgr: np.ndarray,
        bbox: tuple[int, int, int, int],
        *,
        margin_ratio: float = 0.25,
        max_size: int = 512,
        quality: int = 85,
    ) -> str:
        """Recorta a face e devolve JPEG em base64 (sem prefixo data:)."""
        ...
