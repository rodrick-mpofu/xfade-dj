"""Combo payloads. Mirrors the `combos` / `combo_notes` tables."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ComboNoteRead(BaseModel):
    id: UUID
    combo_id: UUID
    text: str
    created_at: datetime


class ComboCreate(BaseModel):
    track_a_id: UUID
    track_b_id: UUID
    technique: str | None = Field(default=None, max_length=120)
    rating: int | None = Field(default=None, ge=1, le=5)
    notes: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _distinct_tracks(self) -> "ComboCreate":
        # Matches the combos_distinct_tracks constraint; caught here it's a 422
        # instead of a database error.
        if self.track_a_id == self.track_b_id:
            raise ValueError("track_a_id and track_b_id must differ.")
        return self


class ComboUpdate(BaseModel):
    """A partial edit. Only the fields actually sent are changed.

    Both fields are nullable *and* optional, which are different things here:
    omitting `rating` leaves it alone, while sending ``null`` clears it. The route
    tells them apart with ``exclude_unset``, so "no opinion" and "no rating" do not
    collapse into each other.

    The tracks are deliberately not editable. Changing either side makes it a
    different transition — the rating and notes were about the old pair — so that
    case is a delete and a re-log, not an edit.
    """

    technique: str | None = Field(default=None, max_length=120)
    rating: int | None = Field(default=None, ge=1, le=5)


class ComboRead(BaseModel):
    id: UUID
    user_id: UUID
    track_a_id: UUID
    track_b_id: UUID
    technique: str | None = None
    rating: int | None = None
    logged_at: datetime
    notes: list[ComboNoteRead] = Field(default_factory=list)
