"""Compatibility response payloads."""

from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class CompatibilityStatus(StrEnum):
    """Why a score may be absent.

    Extraction is asynchronous, so "no score yet" is a normal state rather than an
    error — the combo logger shows progress instead of a failure.
    """

    OK = "ok"
    PENDING_EXTRACTION = "pending_extraction"
    # Distinct from pending on purpose: pending resolves on its own and is worth
    # polling for, failed never will be. Collapsing them makes the UI wait forever.
    EXTRACTION_FAILED = "extraction_failed"
    MISSING_FEATURES = "missing_features"


class HarmonicDetail(BaseModel):
    score: float = Field(ge=0, le=1)
    relation: str
    track_a_key: str
    track_b_key: str


class TempoDetail(BaseModel):
    score: float = Field(ge=0, le=1)
    track_a_bpm: float
    track_b_bpm: float
    delta_bpm: float
    delta_percent: float
    double_time: bool


class CompatibilityRead(BaseModel):
    track_a_id: UUID
    track_b_id: UUID
    status: CompatibilityStatus
    score: int | None = Field(default=None, ge=0, le=100)
    harmonic: HarmonicDetail | None = None
    tempo: TempoDetail | None = None
    notes: list[str] = Field(default_factory=list)
