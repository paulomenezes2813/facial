"""Cliente Qdrant para indexar e buscar embeddings de rostos."""
from __future__ import annotations

from typing import Any

import numpy as np
from loguru import logger
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from .config import settings


class VectorStore:
    def __init__(self) -> None:
        self.client = QdrantClient(url=settings.qdrant_url)
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        existing = [c.name for c in self.client.get_collections().collections]
        if settings.qdrant_collection in existing:
            return
        logger.info(f"Criando coleção Qdrant: {settings.qdrant_collection}")
        self.client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=qmodels.VectorParams(
                size=settings.embedding_size,
                distance=qmodels.Distance.COSINE,
            ),
        )
        # Índice por evento para buscas filtradas eficientes
        self.client.create_payload_index(
            collection_name=settings.qdrant_collection,
            field_name="event_id",
            field_schema=qmodels.PayloadSchemaType.KEYWORD,
        )

    def upsert(
        self,
        point_id: str,
        embedding: np.ndarray,
        payload: dict[str, Any],
    ) -> None:
        self.client.upsert(
            collection_name=settings.qdrant_collection,
            points=[
                qmodels.PointStruct(
                    id=point_id,
                    vector=embedding.tolist(),
                    payload=payload,
                )
            ],
        )

    def search(
        self,
        embedding: np.ndarray,
        event_id: str,
        top_k: int = 1,
    ) -> list[qmodels.ScoredPoint]:
        """Busca filtrando pelo evento. Cosine similarity em [-1, 1]."""
        return self.client.search(
            collection_name=settings.qdrant_collection,
            query_vector=embedding.tolist(),
            query_filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="event_id",
                        match=qmodels.MatchValue(value=event_id),
                    )
                ]
            ),
            limit=top_k,
        )

    def delete(self, point_id: str) -> None:
        self.client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=qmodels.PointIdsList(points=[point_id]),
        )

    def delete_by_event(self, event_id: str) -> None:
        """Usado pelo job de retenção pós-evento."""
        self.client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=qmodels.FilterSelector(
                filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="event_id",
                            match=qmodels.MatchValue(value=event_id),
                        )
                    ]
                )
            ),
        )
