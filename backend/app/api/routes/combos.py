"""Combo logging routes — build spec §5.

    POST /combos   log a combo (track_a, track_b, technique, rating, notes)
    GET  /combos   list logged combos

The `track_id` filter on the listing serves the track-detail view, which shows the
combos a track appears in (build spec §6).

Logging friction is the make-or-break factor for this app (design doc §2), so a
combo is one request: the transition and its notes go in together rather than
making the client chase a second call.
"""

import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUserDep, DbDep
from app.schemas.combo import ComboCreate, ComboRead

logger = logging.getLogger("xfade.combos")

router = APIRouter(prefix="/combos", tags=["combos"])

COMBO_SELECT = "*, combo_notes(*)"


def _normalise(row: dict[str, Any]) -> dict[str, Any]:
    notes = row.get("combo_notes") or []
    if isinstance(notes, dict):
        notes = [notes]
    return {**row, "notes": notes}


def _require_own_tracks(db: Any, user_id: str, track_ids: list[UUID]) -> None:
    """404 for tracks the caller cannot see.

    RLS would refuse the insert anyway, but as an opaque policy violation. Checking
    first turns that into an error naming the track that is actually wrong.
    """
    wanted = [str(t) for t in track_ids]
    response = db.table("tracks").select("id").in_("id", wanted).execute()
    found = {str(row["id"]) for row in response.data or []}
    missing = [t for t in wanted if t not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Track not found: {', '.join(missing)}",
        )


@router.post("", response_model=ComboRead, status_code=status.HTTP_201_CREATED)
def create_combo(payload: ComboCreate, user: CurrentUserDep, db: DbDep) -> dict[str, Any]:
    _require_own_tracks(db, user.id, [payload.track_a_id, payload.track_b_id])

    try:
        response = (
            db.table("combos")
            .insert(
                {
                    "user_id": user.id,
                    "track_a_id": str(payload.track_a_id),
                    "track_b_id": str(payload.track_b_id),
                    "technique": payload.technique,
                    "rating": payload.rating,
                }
            )
            .execute()
        )
    except Exception as exc:
        logger.exception("combo insert failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not log combo: {exc}"
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Combo insert returned no row.",
        )

    combo = response.data[0]
    notes: list[dict[str, Any]] = []

    texts = [text.strip() for text in payload.notes if text and text.strip()]
    if texts:
        try:
            note_response = (
                db.table("combo_notes")
                .insert([{"combo_id": combo["id"], "text": text} for text in texts])
                .execute()
            )
            notes = note_response.data or []
        except Exception:
            # The combo itself is logged and useful; losing a note is not worth
            # failing the request and making the user re-enter the whole thing.
            logger.exception("combo %s saved but notes failed", combo["id"])

    return {**combo, "notes": notes}


@router.get("", response_model=list[ComboRead])
def list_combos(
    user: CurrentUserDep,
    db: DbDep,
    track_id: Annotated[UUID | None, Query(description="Only combos using this track")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[dict[str, Any]]:
    query = db.table("combos").select(COMBO_SELECT).eq("user_id", user.id)

    if track_id is not None:
        # Combos are directional, so a track can sit on either side of one.
        query = query.or_(f"track_a_id.eq.{track_id},track_b_id.eq.{track_id}")

    response = query.order("logged_at", desc=True).range(offset, offset + limit - 1).execute()
    return [_normalise(row) for row in response.data or []]
