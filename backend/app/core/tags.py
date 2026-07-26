"""Reading metadata out of the uploaded file's tags.

Only genre, and only because nothing derives it: Essentia can classify genre but not
reliably enough to store as fact, and the design doc's premise (§1) is deriving what
*can* be derived rather than trusting metadata for everything. Genre is the honest
exception — a DJ library's files usually carry it already.

Deliberately forgiving. A missing, unreadable, or garbage tag is not an upload
failure; the track just has no genre.
"""

import io
import logging

logger = logging.getLogger("xfade.tags")

MAX_GENRE_LENGTH = 80


def read_genre(payload: bytes) -> str | None:
    """Best-effort genre from an in-memory audio file. Never raises."""
    try:
        import mutagen  # noqa: PLC0415 — keeps the import cost off every request path

        parsed = mutagen.File(io.BytesIO(payload), easy=True)
        if parsed is None:
            return None

        values = parsed.get("genre") or []
        genre = str(values[0]).strip() if values else ""
    except Exception:
        # Corrupt or exotic tags are common in a real library and are not worth
        # failing an upload over.
        logger.debug("could not read genre tag", exc_info=True)
        return None

    if not genre:
        return None
    # Some taggers write "(13)" or "Trance/Progressive"; keep it as-is but bounded.
    return genre[:MAX_GENRE_LENGTH]
