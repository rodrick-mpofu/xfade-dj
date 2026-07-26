"""Track library routes — build spec §5.

    POST   /tracks        upload audio -> Storage, row -> tracks, queue extraction
    GET    /tracks        list library (features embedded, for the Library table)
    GET    /tracks/{id}   detail, including extraction status

Audio is uploaded through this process rather than browser-direct to Storage: it
keeps validation and the tracks-row write in one place. If large files start
straining the API process, the swap is a signed-upload-URL endpoint here plus a
direct PUT from the frontend — the object key layout stays the same either way.
"""

import logging
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from app.api.deps import CurrentUserDep, DbDep
from app.config import get_settings
from app.core.audio_files import (
    EXTENSION_MIME_TYPES,
    MAX_UPLOAD_BYTES,
    canonical_mime_for,
    normalise_extension,
)
from app.schemas.track import TrackDetail
from app.services.extraction import schedule_extraction

logger = logging.getLogger("xfade.tracks")

router = APIRouter(prefix="/tracks", tags=["tracks"])

# PostgREST embed. audio_features.track_id is a PK referencing tracks.id, so this
# comes back as a single nested object rather than a list.
TRACK_SELECT = "*, audio_features(*)"

_READ_CHUNK_BYTES = 1024 * 1024


def _normalise(row: dict[str, Any]) -> dict[str, Any]:
    """Flatten PostgREST's embedded features into the shape TrackDetail expects."""
    features = row.get("audio_features")
    if isinstance(features, list):
        features = features[0] if features else None
    return {**row, "audio_features": features}


async def _read_upload(file: UploadFile) -> bytes:
    """Buffer the upload, refusing anything over the bucket's size cap."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(_READ_CHUNK_BYTES):
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MiB limit.",
            )
        chunks.append(chunk)

    if total == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    return b"".join(chunks)


@router.post(
    "",
    response_model=TrackDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a track",
)
async def create_track(
    user: CurrentUserDep,
    db: DbDep,
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File(description="Audio file")],
    title: Annotated[str, Form(min_length=1, max_length=300)],
    artist: Annotated[str | None, Form(max_length=300)] = None,
) -> dict[str, Any]:
    # Form fields, so this cannot ride on the pydantic schema. min_length=1 lets a
    # whitespace-only title through, which then trips the database's
    # length(trim(title)) > 0 check as a 500 instead of a validation error.
    title = title.strip()
    if not title:
        # Literal 422: starlette renamed the constant, and the old name warns.
        raise HTTPException(status_code=422, detail="Title must not be blank.")

    extension = normalise_extension(file.filename)
    if extension is None:
        accepted = ", ".join(sorted(EXTENSION_MIME_TYPES))
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio format. Accepted: {accepted}.",
        )

    payload = await _read_upload(file)

    track_id = uuid4()
    # Layout is load-bearing: the storage policies key off the first path segment.
    object_key = f"{user.id}/{track_id}{extension}"
    bucket = db.storage.from_(get_settings().audio_bucket)

    try:
        bucket.upload(
            object_key,
            payload,
            {"content-type": canonical_mime_for(extension), "upsert": "false"},
        )
    except Exception as exc:
        logger.exception("storage upload failed for %s", object_key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not store the audio file: {exc}",
        ) from exc

    # Object is up; from here any failure has to clean it up or it's orphaned —
    # invisible to the user but still occupying the bucket.
    try:
        track_response = (
            db.table("tracks")
            .insert(
                {
                    "id": str(track_id),
                    "user_id": user.id,
                    "title": title,
                    "artist": artist.strip() if artist else None,
                    "file_ref": object_key,
                    "source": "upload",
                }
            )
            .execute()
        )
        features_response = (
            db.table("audio_features")
            .insert({"track_id": str(track_id), "status": "pending"})
            .execute()
        )
    except Exception as exc:
        logger.exception("track row insert failed for %s; rolling back upload", track_id)
        _rollback_upload(db, bucket, object_key, track_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save the track: {exc}",
        ) from exc

    if not track_response.data:
        _rollback_upload(db, bucket, object_key, track_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Track insert returned no row.",
        )

    schedule_extraction(background_tasks, track_id)

    features = features_response.data[0] if features_response.data else None
    return {**track_response.data[0], "audio_features": features}


def _rollback_upload(db: Any, bucket: Any, object_key: str, track_id: UUID) -> None:
    """Best-effort cleanup. Never raises — the caller is already failing."""
    try:
        bucket.remove([object_key])
    except Exception:
        logger.exception("could not remove orphaned object %s", object_key)
    try:
        db.table("tracks").delete().eq("id", str(track_id)).execute()
    except Exception:
        logger.exception("could not remove partial track row %s", track_id)


@router.get("", response_model=list[TrackDetail], summary="List the library")
def list_tracks(
    user: CurrentUserDep,
    db: DbDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[dict[str, Any]]:
    # RLS already scopes this to the caller; the explicit filter is belt-and-braces
    # and lets the (user_id, created_at) index do the work.
    response = (
        db.table("tracks")
        .select(TRACK_SELECT)
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return [_normalise(row) for row in response.data or []]


@router.get("/{track_id}", response_model=TrackDetail, summary="Track detail")
def get_track(track_id: UUID, user: CurrentUserDep, db: DbDep) -> dict[str, Any]:
    response = db.table("tracks").select(TRACK_SELECT).eq("id", str(track_id)).limit(1).execute()
    if not response.data:
        # RLS makes another user's track indistinguishable from a missing one,
        # which is the behaviour we want.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")
    return _normalise(response.data[0])


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a track")
def delete_track(track_id: UUID, user: CurrentUserDep, db: DbDep) -> None:
    """Remove a track, its features, its audio file, and anything referencing it.

    The foreign keys cascade, so this also deletes every combo the track appears in
    and removes it from any setlist. That is more than "delete this row" implies —
    callers should say so before asking.
    """
    existing = db.table("tracks").select("id, file_ref").eq("id", str(track_id)).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")
    file_ref = existing.data[0].get("file_ref")

    try:
        db.table("tracks").delete().eq("id", str(track_id)).execute()
    except Exception as exc:
        logger.exception("track delete failed for %s", track_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not delete the track: {exc}",
        ) from exc

    # Row first, object second, and only best-effort. The reverse order risks a row
    # pointing at audio that no longer exists, which the UI would show as a playable
    # track that cannot be re-analysed. An orphaned object is invisible by comparison.
    if file_ref:
        try:
            db.storage.from_(get_settings().audio_bucket).remove([file_ref])
        except Exception:
            logger.exception("orphaned storage object %s after deleting track", file_ref)


@router.post(
    "/{track_id}/extract",
    response_model=TrackDetail,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Re-run extraction",
)
def retry_extraction(
    track_id: UUID, user: CurrentUserDep, db: DbDep, background_tasks: BackgroundTasks
) -> dict[str, Any]:
    """Queue extraction again for a track.

    Works from any state, not just `failed`: re-analysing is also how a track picks up
    an improved pipeline. The one exception is a job already running, which would race
    the one in flight for the same row.
    """
    response = db.table("tracks").select(TRACK_SELECT).eq("id", str(track_id)).limit(1).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")

    track = _normalise(response.data[0])
    if not track.get("file_ref"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Track has no stored audio file to analyse.",
        )

    features = track.get("audio_features") or {}
    if features.get("status") == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Extraction is already running for this track.",
        )

    reset = {
        "status": "pending",
        "error_message": None,
        "bpm": None,
        "key_camelot": None,
        "energy": None,
        "danceability": None,
        "structure_markers": None,
        "analyzed_at": None,
    }
    # upsert, not update: a track whose features row was never created still needs one.
    db.table("audio_features").upsert({"track_id": str(track_id), **reset}).execute()

    schedule_extraction(background_tasks, track_id)

    return {**track, "audio_features": {"track_id": str(track_id), **reset}}
