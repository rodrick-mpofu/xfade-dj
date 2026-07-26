"""Genre tag reading.

Real libraries are full of files with missing, truncated or exotic tags, and none of
that should cost the user an upload.
"""

import io

from mutagen.id3 import ID3, TCON
from mutagen.mp3 import MP3

from app.core.tags import MAX_GENRE_LENGTH, read_genre


def _mp3_with_genre(genre: str | None) -> bytes:
    # MPEG-1 Layer III, 128 kbps, 44.1 kHz. The 417-byte frame length is not
    # decorative: mutagen finds the next sync word by stepping exactly that far, so
    # a wrong length reads as "not an MP3".
    frame = b"\xff\xfb\x90\x00" + b"\x00" * 413
    buffer = io.BytesIO(frame * 40)
    audio = MP3(buffer)
    audio.add_tags()
    if genre is not None:
        audio.tags.add(TCON(encoding=3, text=[genre]))
    audio.save(buffer)
    buffer.seek(0)
    return buffer.read()


def test_reads_a_genre_tag():
    assert read_genre(_mp3_with_genre("Amapiano")) == "Amapiano"


def test_missing_tag_returns_none():
    assert read_genre(_mp3_with_genre(None)) is None


def test_blank_tag_returns_none():
    assert read_genre(_mp3_with_genre("   ")) is None


def test_surrounding_whitespace_is_trimmed():
    assert read_genre(_mp3_with_genre("  Trance  ")) == "Trance"


def test_an_overlong_genre_is_bounded():
    result = read_genre(_mp3_with_genre("x" * 500))
    assert result is not None
    assert len(result) == MAX_GENRE_LENGTH


def test_garbage_bytes_do_not_raise():
    # An unreadable file must not fail the upload it arrived with.
    assert read_genre(b"this is not audio at all") is None


def test_empty_payload_does_not_raise():
    assert read_genre(b"") is None


def test_a_slashed_genre_is_kept_verbatim():
    # Taggers write compound genres; guessing at splitting them would lose meaning.
    assert read_genre(_mp3_with_genre("Trance/Progressive")) == "Trance/Progressive"


def test_id3_can_be_read_back(tmp_path):
    # Guards the fixture itself: if this stops writing a tag, the tests above would
    # pass for the wrong reason.
    path = tmp_path / "probe.mp3"
    path.write_bytes(_mp3_with_genre("Techno"))
    assert ID3(path)["TCON"].text == ["Techno"]
