"""Audio feature extraction — stubbed.

Build spec §7 step 3 uploads tracks with the job stubbed; step 4 replaces the body
of :func:`run_extraction` with the real Essentia pass.

The contract the stub preserves, so step 4 is a drop-in:

* the ``audio_features`` row already exists in state ``pending`` before this runs
* the job owns that row's lifecycle: ``pending`` -> ``processing`` -> ``complete``
  or ``failed`` (with ``error_message`` set)
* it writes through the **service-role** client, since a background task outlives
  the request and has no user JWT to borrow — see ``app/db/supabase.py``
* it must never raise into the caller: a failed extraction leaves the track usable,
  just without features

Leaving the status at ``pending`` is deliberate. The track-detail endpoint reports
it honestly, so the frontend shows "extraction pending" rather than a fake result.
"""

import logging
from uuid import UUID

from fastapi import BackgroundTasks

logger = logging.getLogger("xfade.extraction")


def run_extraction(track_id: UUID) -> None:
    """No-op placeholder. Step 4 fills this in."""
    logger.info(
        "extraction stub: track %s stays in state 'pending' (not implemented until "
        "build spec step 4)",
        track_id,
    )


def schedule_extraction(background_tasks: BackgroundTasks, track_id: UUID) -> None:
    """Queue extraction for a freshly uploaded track.

    ``BackgroundTasks`` is enough at personal scale per build spec §5; it only
    becomes a real queue if extraction starts outliving the worker.
    """
    background_tasks.add_task(run_extraction, track_id)
