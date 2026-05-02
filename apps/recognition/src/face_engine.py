"""Factory do engine de reconhecimento facial.

Mantém a interface antiga `FaceEngine.get()` usada por main.py.
A escolha do backend é feita por settings.face_backend (env FACE_BACKEND):
- "insightface" (padrão): Buffalo_L = SCRFD + ArcFace R100. NÃO-COMERCIAL.
- "adaface": MediaPipe BlazeFace + AdaFace IR-101 ONNX. COMERCIAL OK.

Re-exporta FaceData para compatibilidade com código que importava daqui.
"""
from __future__ import annotations

from loguru import logger

from .config import settings
from .face_engine_protocol import FaceData  # noqa: F401  (reexport)


class FaceEngine:
    """Fachada que devolve o engine concreto conforme a config.

    Continua expondo .get() pra não quebrar callers existentes.
    """

    @staticmethod
    def get():
        backend = (settings.face_backend or "insightface").lower()
        if backend == "adaface":
            from .face_engine_adaface import AdaFaceEngine

            logger.info("FACE_BACKEND=adaface")
            return AdaFaceEngine.get()

        if backend != "insightface":
            logger.warning(
                f"FACE_BACKEND='{backend}' desconhecido, caindo pra insightface"
            )

        from .face_engine_insightface import InsightFaceEngine

        logger.info("FACE_BACKEND=insightface")
        return InsightFaceEngine.get()
