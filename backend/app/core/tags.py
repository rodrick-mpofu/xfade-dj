"""Reading metadata out of the uploaded file's tags.

A DJ library's files usually already carry BPM and key, written by Serato or by the
pool the track came from. Those are a genuine second opinion on what extraction
computes, and measurement says they are the better one for key: across 13 real
tracks, tag and Essentia BPM agreed every time, while the key disagreed on 5 — twice
badly enough to turn a compatible pair into a "clash".

So tags are stored *alongside* the derived values rather than replacing them. The
scorer prefers the tag where one exists (see the `*_effective` generated columns in
the migration), and keeping both means the disagreements stay visible instead of
being quietly papered over.

Nothing here raises. Missing, unreadable, or garbage tags are common in a real
library and are never worth failing an upload over — the track simply has no tag
values, and extraction remains the only source.
"""

import io
import logging
import re
from dataclasses import dataclass

from app.core.camelot import to_camelot

logger = logging.getLogger("xfade.tags")

MAX_GENRE_LENGTH = 80

# "Am", "F#m", "Bbm", "C", "F#maj", or a Camelot code that some taggers write directly.
_CAMELOT_RE = re.compile(r"^(1[0-2]|[1-9])([AB])$", re.IGNORECASE)
_KEY_NAME_RE = re.compile(r"^([A-G][#b]?)\s*(m|min|minor|maj|major)?$", re.IGNORECASE)


@dataclass(frozen=True)
class TagFeatures:
    """What the file claims about itself. Any field may be absent."""

    bpm: float | None = None
    key_camelot: str | None = None
    genre: str | None = None


def tag_key_to_camelot(raw: str | None) -> str | None:
    """'G#m' -> '1A'. Passes a Camelot code straight through. None if unrecognised."""
    if not raw:
        return None
    text = raw.strip()

    camelot = _CAMELOT_RE.match(text)
    if camelot:
        return f"{int(camelot.group(1))}{camelot.group(2).upper()}"

    named = _KEY_NAME_RE.match(text)
    if not named:
        return None

    note = named.group(1)[0].upper() + named.group(1)[1:].replace("B", "b")
    suffix = (named.group(2) or "").lower()
    # "maj" also starts with "m", so check it first.
    scale = "major" if suffix.startswith("maj") or not suffix else "minor"
    return to_camelot(note, scale)


def _clean_bpm(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        value = float(str(raw).strip())
    except (TypeError, ValueError):
        return None
    # Same sanity band as the database check constraint.
    return value if 0 < value < 400 else None


def _read(source: object) -> TagFeatures:
    try:
        import mutagen  # noqa: PLC0415 — keeps the import cost off every request path
        from mutagen.easyid3 import EasyID3  # noqa: PLC0415

        # mutagen's "easy" ID3 view maps bpm out of the box but not key, so TKEY is
        # invisible until registered. Idempotent, so doing it per call is harmless.
        EasyID3.RegisterTextKey("key", "TKEY")

        parsed = mutagen.File(source, easy=True)
        if parsed is None:
            return TagFeatures()

        def first(field: str) -> str | None:
            values = parsed.get(field) or []
            return str(values[0]).strip() if values else None

        genre = first("genre")
        return TagFeatures(
            bpm=_clean_bpm(first("bpm")),
            key_camelot=tag_key_to_camelot(first("key")),
            genre=genre[:MAX_GENRE_LENGTH] if genre else None,
        )
    except Exception:
        logger.debug("could not read tags", exc_info=True)
        return TagFeatures()


def read_tags(payload: bytes) -> TagFeatures:
    """Best-effort BPM, key and genre from an in-memory audio file. Never raises."""
    return _read(io.BytesIO(payload))


def read_tags_from_path(path: str) -> TagFeatures:
    """Same, from a file on disk — so the extraction job does not have to load a
    100 MiB track into memory just to read its header."""
    return _read(path)


def read_genre(payload: bytes) -> str | None:
    """Kept for callers that only want the genre."""
    return read_tags(payload).genre
