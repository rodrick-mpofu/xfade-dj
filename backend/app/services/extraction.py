"""Audio feature extraction job — build spec §7 step 4.

Orchestration only; the DSP lives in :mod:`app.services.audio_analysis`.

Contract, unchanged from the step-3 stub:

* the ``audio_features`` row already exists in state ``pending`` before this runs
* the job owns that row's lifecycle: ``pending`` -> ``processing`` -> ``complete``
  or ``failed`` (with ``error_message`` set)
* it writes through the **service-role** client, since a background task outlives
  the request and has no user JWT to borrow — see ``app/db/supabase.py``
* it never raises into the caller: a failed extraction leaves the track usable,
  just without features

``BackgroundTasks`` is enough at personal scale per build spec §5. It only becomes
a real queue if extraction starts outliving the worker process.
"""

import logging
import os
import shutil
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import PurePath
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks

from app.config import get_settings
from app.db.supabase import get_service_client

logger = logging.getLogger("xfade.extraction")


@contextmanager
def _downloaded(db: Any, file_ref: str) -> Iterator[str]:
    """Pull the object out of Storage onto disk, and always clean up after.

    Essentia decodes from a path rather than a buffer, and picks its decoder from
    the file extension, so the suffix is preserved.
    """
    payload = db.storage.from_(get_settings().audio_bucket).download(file_ref)
    directory = tempfile.mkdtemp(prefix="xfade-extract-")
    path = os.path.join(directory, f"audio{PurePath(file_ref).suffix}")
    try:
        with open(path, "wb") as handle:
            handle.write(payload)
        yield path
    finally:
        shutil.rmtree(directory, ignore_errors=True)


def _update_features(db: Any, track_id: UUID, values: dict[str, Any]) -> None:
    db.table("audio_features").update(values).eq("track_id", str(track_id)).execute()


def _mark_failed(db: Any, track_id: UUID, message: str) -> None:
    """Best-effort — if this write also fails the row stays in ``processing``,
    which is at least honest about the job having died mid-flight."""
    try:
        _update_features(
            db,
            track_id,
            {"status": "failed", "error_message": message[:500]},
        )
    except Exception:
        logger.exception("could not record extraction failure for track %s", track_id)


def run_extraction(track_id: UUID) -> None:
    """Analyse one track and write its features. Never raises."""
    from app.services.audio_analysis import analyze_file  # noqa: PLC0415 — essentia is optional

    db = get_service_client()

    try:
        track = db.table("tracks").select("file_ref").eq("id", str(track_id)).limit(1).execute()
        if not track.data:
            raise ValueError("Track row not found.")

        file_ref = track.data[0].get("file_ref")
        if not file_ref:
            raise ValueError("Track has no stored audio file.")

        _update_features(db, track_id, {"status": "processing", "error_message": None})

        with _downloaded(db, file_ref) as path:
            result = analyze_file(path)

        if result.key_camelot is None:
            # audio_features_complete_has_values requires bpm and key_camelot for
            # 'complete'. Reporting failure beats tripping the constraint and
            # leaving the row stuck in 'processing'.
            raise ValueError("Key detection produced no usable Camelot code.")

        _update_features(
            db,
            track_id,
            {
                "status": "complete",
                "bpm": result.bpm,
                "key_camelot": result.key_camelot,
                "energy": result.energy,
                "danceability": result.danceability,
                "duration_seconds": result.duration_seconds,
                "structure_markers": result.structure_markers,
                "error_message": None,
                "analyzed_at": datetime.now(UTC).isoformat(),
            },
        )
        logger.info("extracted track %s: %s BPM, %s", track_id, result.bpm, result.key_camelot)

    except Exception as exc:
        logger.exception("extraction failed for track %s", track_id)
        _mark_failed(db, track_id, str(exc))


def schedule_extraction(background_tasks: BackgroundTasks, track_id: UUID) -> None:
    """Queue extraction for a freshly uploaded track."""
    background_tasks.add_task(run_extraction, track_id)
