"""Anti-spoofing leve.

Esqueleto. Para o MVP usamos um score heurístico baseado em det_score + variância
de Laplaciano (proxy de foco). Em uma fase posterior plugamos
Silent-Face-Anti-Spoofing (MiniFASNet) ou similar.
"""
from __future__ import annotations

import cv2
import numpy as np


def laplacian_variance(image_bgr: np.ndarray) -> float:
    """Quanto maior, mais nítida a imagem (foto impressa tende a borrar)."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def liveness_score(image_bgr: np.ndarray, det_score: float) -> float:
    """Score [0, 1] heurístico. Substituir por modelo dedicado em fase posterior."""
    sharpness = laplacian_variance(image_bgr)
    # Normalização empírica: sharpness > 100 é razoável; > 300 é ótimo.
    sharpness_norm = min(sharpness / 300.0, 1.0)
    # Combina detecção + nitidez
    return float(0.5 * det_score + 0.5 * sharpness_norm)
