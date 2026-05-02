"""API FastAPI do microserviço de reconhecimento facial."""
from __future__ import annotations

import json
import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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


def _log_json(level: str, payload: dict) -> None:
    """
    Log estruturado em JSON (uma linha).
    Importante: não incluir imagem/base64/embeddings para evitar vazamento de dados.
    """
    msg = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)
    if level == "debug":
        logger.debug(msg)
    elif level == "warning":
        logger.warning(msg)
    elif level == "error":
        logger.error(msg)
    else:
        logger.info(msg)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = str(uuid.uuid4())
    _log_json(
        "warning",
        {
            "type": "http.validation_error",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else None,
            "errors": exc.errors(),
        },
    )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/health")
async def health() -> dict:
    backend = (settings.face_backend or "insightface").lower()
    if backend == "adaface":
        return {
            "status": "ok",
            "backend": "adaface",
            "model": "adaface_ir101_webface4m",
            "onnx_path": settings.adaface_model_path,
        }
    return {"status": "ok", "backend": "insightface", "model": settings.insightface_model}


@app.post("/enroll", response_model=EnrollResponse)
async def enroll(req: EnrollRequest, request: Request) -> EnrollResponse:
    engine = FaceEngine.get()
    store = VectorStore()
    request_id = str(uuid.uuid4())

    t0 = time.perf_counter()
    img = engine.decode_base64_image(req.image_base64)
    t_decode = time.perf_counter() - t0

    t1 = time.perf_counter()
    faces = engine.analyze(img)
    t_detect = time.perf_counter() - t1

    if len(faces) == 0:
        _log_json(
            "info",
            {
                "type": "recognition.enroll",
                "request_id": request_id,
                "client_ip": request.client.host if request.client else None,
                "event_id": req.event_id,
                "attendee_id": req.attendee_id,
                "face_count": 0,
                "reason": "no_face",
                "timings_ms": {"decode": round(t_decode * 1000, 1), "detect": round(t_detect * 1000, 1)},
            },
        )
        raise HTTPException(400, detail={"reason": "no_face", "message": "Nenhum rosto detectado"})
    if len(faces) > 1:
        _log_json(
            "info",
            {
                "type": "recognition.enroll",
                "request_id": request_id,
                "client_ip": request.client.host if request.client else None,
                "event_id": req.event_id,
                "attendee_id": req.attendee_id,
                "face_count": len(faces),
                "reason": "multiple_faces",
                "timings_ms": {"decode": round(t_decode * 1000, 1), "detect": round(t_detect * 1000, 1)},
            },
        )
        raise HTTPException(
            400,
            detail={"reason": "multiple_faces", "message": "Mais de um rosto na imagem"},
        )

    face = faces[0]
    live = liveness_score(img, face.det_score)

    if live < settings.min_liveness_score:
        _log_json(
            "info",
            {
                "type": "recognition.enroll",
                "request_id": request_id,
                "client_ip": request.client.host if request.client else None,
                "event_id": req.event_id,
                "attendee_id": req.attendee_id,
                "face_count": 1,
                "det_score": round(face.det_score, 4),
                "liveness_score": round(live, 4),
                "min_liveness_score": settings.min_liveness_score,
                "reason": "low_liveness",
                "timings_ms": {"decode": round(t_decode * 1000, 1), "detect": round(t_detect * 1000, 1)},
            },
        )
        raise HTTPException(
            400,
            detail={"reason": "low_liveness", "message": "Falha na verificação anti-spoofing"},
        )

    embedding_id = str(uuid.uuid4())
    face_b64 = engine.crop_face_base64_jpeg(img, face.bbox)
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

    _log_json(
        "info",
        {
            "type": "recognition.enroll",
            "request_id": request_id,
            "client_ip": request.client.host if request.client else None,
            "event_id": req.event_id,
            "attendee_id": req.attendee_id,
            "embedding_id": embedding_id,
            "face_count": 1,
            "det_score": round(face.det_score, 4),
            "liveness_score": round(live, 4),
            "timings_ms": {"decode": round(t_decode * 1000, 1), "detect": round(t_detect * 1000, 1)},
            "reason": "ok",
        },
    )

    return EnrollResponse(
        attendee_id=req.attendee_id,
        embedding_id=embedding_id,
        quality_score=face.det_score,
        liveness_score=live,
        face_count=1,
        face_image_base64=face_b64,
    )


@app.post("/match", response_model=MatchResponse)
async def match(req: MatchRequest, request: Request) -> MatchResponse:
    engine = FaceEngine.get()
    store = VectorStore()
    threshold = req.threshold if req.threshold is not None else settings.match_threshold
    request_id = str(uuid.uuid4())

    t0 = time.perf_counter()
    img = engine.decode_base64_image(req.image_base64)
    faces = engine.analyze(img)
    t_detect = time.perf_counter() - t0

    if len(faces) == 0:
        _log_json(
            "info",
            {
                "type": "recognition.match",
                "request_id": request_id,
                "client_ip": request.client.host if request.client else None,
                "event_id": req.event_id,
                "threshold": threshold,
                "face_count": 0,
                "reason": "no_face",
                "timings_ms": {"detect_total": round(t_detect * 1000, 1)},
            },
        )
        return MatchResponse(matched=False, liveness_score=0.0, reason="no_face")
    if len(faces) > 1:
        _log_json(
            "info",
            {
                "type": "recognition.match",
                "request_id": request_id,
                "client_ip": request.client.host if request.client else None,
                "event_id": req.event_id,
                "threshold": threshold,
                "face_count": len(faces),
                "reason": "multiple_faces",
                "timings_ms": {"detect_total": round(t_detect * 1000, 1)},
            },
        )
        return MatchResponse(matched=False, liveness_score=0.0, reason="multiple_faces")

    face = faces[0]
    live = liveness_score(img, face.det_score)
    if live < settings.min_liveness_score:
        _log_json(
            "info",
            {
                "type": "recognition.match",
                "request_id": request_id,
                "client_ip": request.client.host if request.client else None,
                "event_id": req.event_id,
                "threshold": threshold,
                "face_count": 1,
                "det_score": round(face.det_score, 4),
                "liveness_score": round(live, 4),
                "min_liveness_score": settings.min_liveness_score,
                "reason": "low_liveness",
                "timings_ms": {"detect_total": round(t_detect * 1000, 1)},
            },
        )
        return MatchResponse(matched=False, liveness_score=live, reason="low_liveness")

    t1 = time.perf_counter()
    hits = store.search(face.embedding, event_id=req.event_id, top_k=1)
    t_search = time.perf_counter() - t1

    _log_json(
        "debug",
        {
            "type": "recognition.match.timing",
            "request_id": request_id,
            "event_id": req.event_id,
            "timings_ms": {
                "detect_total": round(t_detect * 1000, 1),
                "search": round(t_search * 1000, 1),
            },
        },
    )

    if not hits:
        _log_json(
            "info",
            {
                "type": "recognition.match",
                "request_id": request_id,
                "client_ip": request.client.host if request.client else None,
                "event_id": req.event_id,
                "threshold": threshold,
                "face_count": 1,
                "det_score": round(face.det_score, 4),
                "liveness_score": round(live, 4),
                "reason": "below_threshold",
                "similarity": None,
                "timings_ms": {
                    "detect_total": round(t_detect * 1000, 1),
                    "search": round(t_search * 1000, 1),
                },
            },
        )
        return MatchResponse(matched=False, liveness_score=live, reason="below_threshold")

    top = hits[0]
    if top.score < threshold:
        _log_json(
            "info",
            {
                "type": "recognition.match",
                "request_id": request_id,
                "client_ip": request.client.host if request.client else None,
                "event_id": req.event_id,
                "threshold": threshold,
                "face_count": 1,
                "det_score": round(face.det_score, 4),
                "liveness_score": round(live, 4),
                "reason": "below_threshold",
                "attendee_id": top.payload.get("attendee_id"),
                "similarity": round(float(top.score), 6),
                "timings_ms": {
                    "detect_total": round(t_detect * 1000, 1),
                    "search": round(t_search * 1000, 1),
                },
            },
        )
        return MatchResponse(
            matched=False,
            similarity=float(top.score),
            liveness_score=live,
            reason="below_threshold",
        )

    _log_json(
        "info",
        {
            "type": "recognition.match",
            "request_id": request_id,
            "client_ip": request.client.host if request.client else None,
            "event_id": req.event_id,
            "threshold": threshold,
            "face_count": 1,
            "det_score": round(face.det_score, 4),
            "liveness_score": round(live, 4),
            "reason": "ok",
            "attendee_id": top.payload.get("attendee_id"),
            "similarity": round(float(top.score), 6),
            "timings_ms": {
                "detect_total": round(t_detect * 1000, 1),
                "search": round(t_search * 1000, 1),
            },
        },
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
