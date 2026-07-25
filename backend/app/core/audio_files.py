"""Accepted audio formats for track upload.

The extension drives everything: browsers are inconsistent about the MIME type they
attach to audio uploads (``audio/mp3`` vs ``audio/mpeg`` vs ``application/octet-stream``
for the same file), so the client-supplied content type is not trusted. The extension
is validated against this table and the canonical MIME is sent to Storage instead.

Every value here must stay inside the ``allowed_mime_types`` list on the `tracks`
bucket (see ``20260725120200_storage_bucket.sql``) — a mismatch surfaces as an
upload rejection from Storage rather than a clean 415 from us.
"""

from pathlib import PurePath

# Matches the bucket's file_size_limit. Enforced here too so an oversized upload is
# rejected while streaming in, rather than after buffering the whole body.
MAX_UPLOAD_BYTES = 100 * 1024 * 1024

EXTENSION_MIME_TYPES: dict[str, str] = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".aiff": "audio/aiff",
    ".aif": "audio/aiff",
}


def normalise_extension(filename: str | None) -> str | None:
    """Lower-cased extension if it's one we accept, else ``None``."""
    if not filename:
        return None
    extension = PurePath(filename).suffix.lower()
    return extension if extension in EXTENSION_MIME_TYPES else None


def canonical_mime_for(extension: str) -> str:
    return EXTENSION_MIME_TYPES[extension]
