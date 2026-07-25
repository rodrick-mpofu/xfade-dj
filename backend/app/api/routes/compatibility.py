"""Compatibility scoring endpoint — build spec §5.

    GET /compatibility?track_a={id}&track_b={id}

Reads the two ``audio_features`` rows and scores them on the fly. No stored model,
no ML — see design doc §5 for why v1 stops at rules.
"""

from dataclasses import asdict
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUserDep, DbDep
from app.core.compatibility import TrackFeatures, score_compatibility
from app.schemas.compatibility import CompatibilityRead, CompatibilityStatus

router = APIRouter(prefix="/compatibility", tags=["compatibility"])


def _features_for(row: dict[str, Any]) -> dict[str, Any] | None:
    features = row.get("audio_features")
    if isinstance(features, list):
        features = features[0] if features else None
    return features


@router.get("", response_model=CompatibilityRead, summary="Score a track pair")
def get_compatibility(
    user: CurrentUserDep,
    db: DbDep,
    track_a: Annotated[UUID, Query(description="First track")],
    track_b: Annotated[UUID, Query(description="Second track")],
) -> dict[str, Any]:
    if track_a == track_b:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A track cannot be scored against itself.",
        )

    response = (
        db.table("tracks")
        .select("id, audio_features(*)")
        .in_("id", [str(track_a), str(track_b)])
        .execute()
    )
    rows = {str(row["id"]): row for row in response.data or []}

    missing = [str(t) for t in (track_a, track_b) if str(t) not in rows]
    if missing:
        # RLS makes another user's track look identical to a missing one.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Track not found: {', '.join(missing)}",
        )

    base = {"track_a_id": track_a, "track_b_id": track_b}
    features = [_features_for(rows[str(t)]) for t in (track_a, track_b)]

    if any(f is None for f in features):
        return {**base, "status": CompatibilityStatus.MISSING_FEATURES}

    if any(f["status"] == "failed" for f in features):
        # Terminal: the frontend should stop waiting and offer a retry instead.
        return {**base, "status": CompatibilityStatus.EXTRACTION_FAILED}

    if any(f["status"] != "complete" for f in features):
        # Still running. A normal state, not an error — the combo logger shows
        # progress and polls.
        return {**base, "status": CompatibilityStatus.PENDING_EXTRACTION}

    if any(f.get("bpm") is None or f.get("key_camelot") is None for f in features):
        return {**base, "status": CompatibilityStatus.MISSING_FEATURES}

    result = score_compatibility(
        TrackFeatures(bpm=features[0]["bpm"], key_camelot=features[0]["key_camelot"]),
        TrackFeatures(bpm=features[1]["bpm"], key_camelot=features[1]["key_camelot"]),
    )

    return {
        **base,
        "status": CompatibilityStatus.OK,
        "score": result.score,
        "harmonic": asdict(result.harmonic),
        "tempo": asdict(result.tempo),
        "notes": result.notes,
    }
