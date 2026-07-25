"""Track and audio-feature payloads. Mirrors the `tracks` / `audio_features` tables."""

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ExtractionStatus(StrEnum):
    """Mirrors the `public.extraction_status` enum."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class TrackCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    artist: str | None = Field(default=None, max_length=300)
    source: Literal["upload", "import"] = "upload"


class TrackRead(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    artist: str | None = None
    file_ref: str | None = None
    source: str
    created_at: datetime


class AudioFeaturesRead(BaseModel):
    track_id: UUID
    status: ExtractionStatus
    bpm: float | None = None
    key_camelot: str | None = None
    energy: float | None = None
    danceability: float | None = None
    structure_markers: dict[str, Any] | None = None
    error_message: str | None = None
    analyzed_at: datetime | None = None


class TrackDetail(TrackRead):
    """`GET /tracks/{id}`. Features are absent until extraction has run."""

    audio_features: AudioFeaturesRead | None = None
