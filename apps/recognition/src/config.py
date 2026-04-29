"""Configurações via variáveis de ambiente."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Servidor
    recognition_port: int = 8000

    # InsightFace
    insightface_model: str = "buffalo_l"
    insightface_det_size: int = 640
    # Use ctx_id=0 para GPU NVIDIA, -1 para CPU
    insightface_ctx_id: int = -1

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "face_embeddings"
    embedding_size: int = 512  # ArcFace R100

    # Reconhecimento
    match_threshold: float = 0.45
    min_face_quality: float = 0.5
    min_liveness_score: float = 0.5


settings = Settings()
