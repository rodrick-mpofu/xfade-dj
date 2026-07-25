"""Session / setlist payloads. Mirrors the `sessions` / `session_tracks` tables."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    planned_for: datetime | None = None


class SessionTrackRead(BaseModel):
    id: UUID
    session_id: UUID
    track_id: UUID
    position: int = Field(ge=0)


class SessionRead(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    planned_for: datetime | None = None
    created_at: datetime
    tracks: list[SessionTrackRead] = Field(default_factory=list)
