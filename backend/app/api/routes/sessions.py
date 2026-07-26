"""Session / setlist routes — build spec §5.

    POST /sessions              create a session
    GET  /sessions              list sessions
    GET  /sessions/{id}         detail, tracks in play order
    POST /sessions/{id}/tracks  append a track
    PUT  /sessions/{id}/tracks  replace the setlist, in order

The detail and PUT routes are not in the spec's endpoint list, but §6 requires the
planner to load a session and to *reorder* it, and neither is expressible with the
listed endpoints alone. PUT delegates to the `set_session_tracks` function so a
reorder is atomic rather than a delete-then-insert that can strand a setlist empty.
"""

import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUserDep, DbDep
from app.schemas.session import (
    SessionCreate,
    SessionRead,
    SessionTrackAdd,
    SessionTrackRead,
    SessionTracksReplace,
)

logger = logging.getLogger("xfade.sessions")

router = APIRouter(prefix="/sessions", tags=["sessions"])

SESSION_SELECT = "*, session_tracks(*)"


def _normalise(row: dict[str, Any]) -> dict[str, Any]:
    tracks = row.get("session_tracks") or []
    if isinstance(tracks, dict):
        tracks = [tracks]
    # Play order is the point of a setlist; never leave it to insertion order.
    return {**row, "tracks": sorted(tracks, key=lambda t: t["position"])}


def _require_session(db: Any, session_id: UUID) -> dict[str, Any]:
    response = (
        db.table("sessions").select(SESSION_SELECT).eq("id", str(session_id)).limit(1).execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return response.data[0]


def _require_own_tracks(db: Any, track_ids: list[UUID]) -> None:
    if not track_ids:
        return
    wanted = [str(t) for t in track_ids]
    response = db.table("tracks").select("id").in_("id", wanted).execute()
    found = {str(row["id"]) for row in response.data or []}
    missing = [t for t in wanted if t not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Track not found: {', '.join(missing)}",
        )


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreate, user: CurrentUserDep, db: DbDep) -> dict[str, Any]:
    response = (
        db.table("sessions")
        .insert(
            {
                "user_id": user.id,
                # Already stripped and checked non-blank by the schema.
                "name": payload.name,
                "planned_for": payload.planned_for.isoformat() if payload.planned_for else None,
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session insert returned no row.",
        )
    return {**response.data[0], "tracks": []}


@router.get("", response_model=list[SessionRead])
def list_sessions(
    user: CurrentUserDep,
    db: DbDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[dict[str, Any]]:
    response = (
        db.table("sessions")
        .select(SESSION_SELECT)
        .eq("user_id", user.id)
        .order("planned_for", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return [_normalise(row) for row in response.data or []]


@router.get("/{session_id}", response_model=SessionRead)
def get_session(session_id: UUID, user: CurrentUserDep, db: DbDep) -> dict[str, Any]:
    return _normalise(_require_session(db, session_id))


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: UUID, user: CurrentUserDep, db: DbDep) -> None:
    """Remove a session and its setlist entries (which cascade).

    Only the setlist is discarded — the tracks themselves are untouched, and so are
    any combos logged while playing it.
    """
    _require_session(db, session_id)
    db.table("sessions").delete().eq("id", str(session_id)).execute()


@router.post(
    "/{session_id}/tracks",
    response_model=SessionTrackRead,
    status_code=status.HTTP_201_CREATED,
)
def add_session_track(
    session_id: UUID, payload: SessionTrackAdd, user: CurrentUserDep, db: DbDep
) -> dict[str, Any]:
    session = _require_session(db, session_id)
    _require_own_tracks(db, [payload.track_id])

    existing = session.get("session_tracks") or []
    next_position = max((t["position"] for t in existing), default=-1) + 1

    try:
        response = (
            db.table("session_tracks")
            .insert(
                {
                    "session_id": str(session_id),
                    "track_id": str(payload.track_id),
                    "position": next_position,
                }
            )
            .execute()
        )
    except Exception as exc:
        # unique(session_id, position) — two appends racing for the same slot.
        # Single-user at v1, so a clear error beats a retry loop.
        logger.exception("session track insert failed")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Could not add track to session: {exc}",
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session track insert returned no row.",
        )
    return response.data[0]


@router.put("/{session_id}/tracks", response_model=list[SessionTrackRead])
def replace_session_tracks(
    session_id: UUID, payload: SessionTracksReplace, user: CurrentUserDep, db: DbDep
) -> list[dict[str, Any]]:
    _require_session(db, session_id)
    _require_own_tracks(db, payload.track_ids)

    try:
        response = db.rpc(
            "set_session_tracks",
            {
                "p_session_id": str(session_id),
                "p_track_ids": [str(t) for t in payload.track_ids],
            },
        ).execute()
    except Exception as exc:
        logger.exception("setlist replace failed for session %s", session_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update the setlist: {exc}",
        ) from exc

    return sorted(response.data or [], key=lambda t: t["position"])
