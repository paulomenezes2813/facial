"""Schemas pydantic. Espelham `packages/shared/src/schemas/recognition.ts`."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class EnrollRequest(BaseModel):
    attendee_id: str = Field(alias="attendeeId")
    event_id: str = Field(alias="eventId")
    image_base64: str = Field(alias="imageBase64", min_length=100)

    model_config = {"populate_by_name": True}


class EnrollResponse(BaseModel):
    attendee_id: str
    embedding_id: str
    quality_score: float
    liveness_score: float
    face_count: int


class MatchRequest(BaseModel):
    event_id: str = Field(alias="eventId")
    image_base64: str = Field(alias="imageBase64", min_length=100)
    threshold: float | None = None

    model_config = {"populate_by_name": True}


MatchReason = Literal["no_face", "multiple_faces", "low_liveness", "below_threshold", "ok"]


class MatchResponse(BaseModel):
    matched: bool
    attendee_id: str | None = None
    similarity: float | None = None
    liveness_score: float
    reason: MatchReason


class DeleteResponse(BaseModel):
    ok: bool
