"""API FastAPI do microserviço de reconhecimento facial."""
from __future__ import annotations

import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .config import settings
from .face_engine import FaceEngine
from .liveness import liveness_score
from .schemas import (
    DeleteResponse,
    EnrollRequest,
    EnrollResponse,
    MatchRequest,
    MatchResponse,
)
from .vector_store import VectorStore

app = FastAPI(title="Facial Recognition Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restringir em produção
    allow_methods=["*"],
    allow_headers=["*"],
)


# Inicialização lazy: o modelo só carrega na primeira request
@app.on_event("startup")
async def startup() -> None:
    logger.info("Pré-aquecendo o motor de reconhecimento...")
    FaceEngine.get()
    VectorStore()
    logger.info("Microserviço pronto.")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": settings.insightface_model}


@app.post("/enroll", response_model=EnrollResponse)
async def enroll(req: EnrollRequest) -> EnrollResponse:
    engine = FaceEngine.get()
    store = VectorStore()

    img = engine.decode_base64_image(req.image_base64)
    faces = engine.analyze(img)

    if len(faces) == 0:
        raise HTTPException(400, detail={"reason": "no_face", "message": "Nenhum rosto detectado"})
    if len(faces) > 1:
        raise HTTPException(
            400,
            detail={"reason": "multiple_faces", "message": "Mais de um rosto na imagem"},
        )

    face = faces[0]
    live = liveness_score(img, face.det_score)

    if live < settings.min_liveness_score:
        raise HTTPException(
            400,
            detail={"reason": "low_liveness", "message": "Falha na verificação anti-spoofing"},
        )

    embedding_id = str(uuid.uuid4())
    store.upsert(
        point_id=embedding_id,
        embedding=face.embedding,
        payload={
            "attendee_id": req.attendee_id,
            "event_id": req.event_id,
            "det_score": face.det_score,
            "liveness": live,
        },
    )

    return EnrollResponse(
        attendee_id=req.attendee_id,
        embedding_id=embedding_id,
        quality_score=face.det_score,
        liveness_score=live,
        face_count=1,
    )


@app.post("/match", response_model=MatchResponse)
async def match(req: MatchRequest) -> MatchResponse:
    engine = FaceEngine.get()
    store = VectorStore()
    threshold = req.threshold if req.threshold is not None else settings.match_threshold

    t0 = time.perf_counter()
    img = engine.decode_base64_image(req.image_base64)
    faces = engine.analyze(img)
    t_detect = time.perf_counter() - t0

    if len(faces) == 0:
        return MatchResponse(matched=False, liveness_score=0.0, reason="no_face")
    if len(faces) > 1:
        return MatchResponse(matched=False, liveness_score=0.0, reason="multiple_faces")

    face = faces[0]
    live = liveness_score(img, face.det_score)
    if live < settings.min_liveness_score:
        return MatchResponse(matched=False, liveness_score=live, reason="low_liveness")

    t1 = time.perf_counter()
    hits = store.search(face.embedding, event_id=req.event_id, top_k=1)
    t_search = time.perf_counter() - t1

    logger.debug(f"detect={t_detect*1000:.1f}ms search={t_search*1000:.1f}ms")

    if not hits:
        return MatchResponse(matched=False, liveness_score=live, reason="below_threshold")

    top = hits[0]
    if top.score < threshold:
        return MatchResponse(
            matched=False,
            similarity=float(top.score),
            liveness_score=live,
            reason="below_threshold",
        )

    return MatchResponse(
        matched=True,
        attendee_id=top.payload.get("attendee_id"),
        similarity=float(top.score),
        liveness_score=live,
        reason="ok",
    )


@app.delete("/embeddings/{embedding_id}", response_model=DeleteResponse)
async def delete_embedding(embedding_id: str) -> DeleteResponse:
    VectorStore().delete(embedding_id)
    return DeleteResponse(ok=True)


@app.delete("/events/{event_id}/embeddings", response_model=DeleteResponse)
async def delete_event(event_id: str) -> DeleteResponse:
    """Usado pelo job de retenção (LGPD)."""
    VectorStore().delete_by_event(event_id)
    return DeleteResponse(ok=True)
