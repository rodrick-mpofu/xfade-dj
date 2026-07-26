"""Track and audio-feature payloads. Mirrors the `tracks` / `audio_features` tables."""

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import NonBlankTitle


class ExtractionStatus(StrEnum):
    """Mirrors the `public.extraction_status` enum."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class TrackCreate(BaseModel):
    title: NonBlankTitle
    artist: str | None = Field(default=None, max_length=300)
    source: Literal["upload", "import"] = "upload"


class TrackRead(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    artist: str | None = None
    genre: str | None = None
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
    duration_seconds: float | None = None

    # Read from the file's tags rather than derived. Kept beside the analysed values
    # so a disagreement is visible instead of silently resolved.
    bpm_tag: float | None = None
    key_camelot_tag: str | None = None

    # What scoring actually uses: the tag when present, otherwise the analysis.
    # Generated in the database so the rule cannot drift between callers.
    bpm_effective: float | None = None
    key_camelot_effective: str | None = None

    structure_markers: dict[str, Any] | None = None
    error_message: str | None = None
    analyzed_at: datetime | None = None


class TrackDetail(TrackRead):
    """`GET /tracks/{id}`. Features are absent until extraction has run."""

    audio_features: AudioFeaturesRead | None = None
