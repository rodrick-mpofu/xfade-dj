"""Session / setlist payloads. Mirrors the `sessions` / `session_tracks` tables."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import NonBlankName


class SessionCreate(BaseModel):
    name: NonBlankName
    planned_for: datetime | None = None


class SessionTrackRead(BaseModel):
    id: UUID
    session_id: UUID
    track_id: UUID
    position: int = Field(ge=0)


class SessionTrackAdd(BaseModel):
    """Append one track to the end of a setlist."""

    track_id: UUID


class SessionTracksReplace(BaseModel):
    """Replace the whole setlist, in order.

    One primitive covering add, remove, and reorder — which is how a drag-and-drop
    planner actually behaves. An empty list clears the setlist.
    """

    track_ids: list[UUID] = Field(default_factory=list)


class SessionRead(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    planned_for: datetime | None = None
    created_at: datetime
    tracks: list[SessionTrackRead] = Field(default_factory=list)
