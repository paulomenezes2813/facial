"""Configurações via variáveis de ambiente."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Servidor
    recognition_port: int = 8000

    # Engine de reconhecimento: "insightface" (default) | "adaface"
    # IMPORTANTE: trocar de backend exige reindexar todos os embeddings,
    # pois cada modelo gera vetores em espaços diferentes.
    face_backend: str = "insightface"

    # InsightFace
    insightface_model: str = "buffalo_l"
    insightface_det_size: int = 640
    # Use ctx_id=0 para GPU NVIDIA, -1 para CPU
    insightface_ctx_id: int = -1

    # AdaFace
    # Caminho para o ONNX já convertido (use scripts/setup_adaface.py).
    adaface_model_path: str = "models/adaface_ir101_webface4m.onnx"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "face_embeddings"
    embedding_size: int = 512  # ArcFace R100 e AdaFace IR-101 — ambos 512

    # Reconhecimento
    match_threshold: float = 0.45
    min_face_quality: float = 0.5
    min_liveness_score: float = 0.5

    # Seleção de face em /match (totem): quando há várias pessoas no fundo,
    # tentamos escolher a face dominante (maior e mais central) em vez de falhar.
    # Se houver ambiguidade (2 rostos grandes), devolve "multiple_faces".
    match_select_primary_face: bool = True
    # Centro da tela: caixa de ROI com este tamanho relativo (0.0–1.0).
    match_roi_size: float = 0.6
    # Se a 2ª maior face tiver área >= (maior * ratio), consideramos ambíguo.
    match_ambiguity_ratio: float = 0.75


settings = Settings()
