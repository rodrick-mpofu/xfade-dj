"""Tag reading.

Real libraries are full of files with missing, truncated or exotic tags, and none of
that should cost the user an upload.
"""

import io

import pytest
from mutagen.id3 import ID3, TBPM, TCON, TKEY
from mutagen.mp3 import MP3

from app.core.tags import MAX_GENRE_LENGTH, read_genre, read_tags, tag_key_to_camelot


def _mp3(genre: str | None = None, key: str | None = None, bpm: str | None = None) -> bytes:
    # MPEG-1 Layer III, 128 kbps, 44.1 kHz. The 417-byte frame length is not
    # decorative: mutagen finds the next sync word by stepping exactly that far, so
    # a wrong length reads as "not an MP3".
    frame = b"\xff\xfb\x90\x00" + b"\x00" * 413
    buffer = io.BytesIO(frame * 40)
    audio = MP3(buffer)
    audio.add_tags()
    if genre is not None:
        audio.tags.add(TCON(encoding=3, text=[genre]))
    if key is not None:
        audio.tags.add(TKEY(encoding=3, text=[key]))
    if bpm is not None:
        audio.tags.add(TBPM(encoding=3, text=[bpm]))
    audio.save(buffer)
    buffer.seek(0)
    return buffer.read()


# --- key notation -----------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Am", "8A"),
        ("A", "11B"),
        ("Gm", "6A"),
        ("F#m", "11A"),
        ("Bbm", "3A"),
        ("Abm", "1A"),
        ("C", "8B"),
        ("Cmaj", "8B"),
        ("Cminor", "5A"),
        ("  Dm  ", "7A"),
    ],
)
def test_musical_notation_maps_to_camelot(raw, expected):
    assert tag_key_to_camelot(raw) == expected


@pytest.mark.parametrize("raw", ["8A", "12b", "1A"])
def test_a_camelot_code_passes_through(raw):
    # Some taggers write Camelot directly; re-deriving it would be a chance to differ.
    assert tag_key_to_camelot(raw) == raw.upper()


@pytest.mark.parametrize("raw", [None, "", "   ", "H", "banana", "13A", "0A", "Cdorian"])
def test_unusable_key_text_returns_none(raw):
    assert tag_key_to_camelot(raw) is None


def test_maj_is_not_mistaken_for_minor():
    # "maj" starts with "m"; a naive prefix check turns every major key minor.
    assert tag_key_to_camelot("Fmaj") == tag_key_to_camelot("F")
    assert tag_key_to_camelot("Fmaj") != tag_key_to_camelot("Fm")


# --- reading a file ---------------------------------------------------------


def test_reads_bpm_key_and_genre():
    tags = read_tags(_mp3(genre="Amapiano", key="Gm", bpm="114"))

    assert tags.genre == "Amapiano"
    assert tags.key_camelot == "6A"
    assert tags.bpm == 114.0


def test_a_file_with_no_tags_yields_nothing():
    tags = read_tags(_mp3())
    assert (tags.bpm, tags.key_camelot, tags.genre) == (None, None, None)


def test_partial_tags_are_fine():
    # Plenty of files carry BPM but no key.
    tags = read_tags(_mp3(bpm="128"))
    assert tags.bpm == 128.0
    assert tags.key_camelot is None


@pytest.mark.parametrize("bpm", ["0", "-5", "900", "not a number", ""])
def test_implausible_bpm_is_discarded(bpm):
    # The database rejects these anyway; catching them here keeps the insert clean.
    assert read_tags(_mp3(bpm=bpm)).bpm is None


def test_an_unmappable_key_tag_is_dropped_rather_than_guessed():
    assert read_tags(_mp3(key="Zq")).key_camelot is None


def test_garbage_bytes_do_not_raise():
    tags = read_tags(b"this is not audio at all")
    assert (tags.bpm, tags.key_camelot, tags.genre) == (None, None, None)


def test_empty_payload_does_not_raise():
    assert read_tags(b"").genre is None


# --- genre ------------------------------------------------------------------


def test_genre_whitespace_is_trimmed():
    assert read_genre(_mp3(genre="  Trance  ")) == "Trance"


def test_an_overlong_genre_is_bounded():
    result = read_genre(_mp3(genre="x" * 500))
    assert result is not None
    assert len(result) == MAX_GENRE_LENGTH


def test_a_slashed_genre_is_kept_verbatim():
    # Taggers write compound genres; guessing at splitting them would lose meaning.
    assert read_genre(_mp3(genre="Trance/Progressive")) == "Trance/Progressive"


def test_the_fixture_really_writes_tags(tmp_path):
    # Guards the fixture itself: if this stops writing tags, the tests above would
    # pass for the wrong reason.
    path = tmp_path / "probe.mp3"
    path.write_bytes(_mp3(genre="Techno", key="Am", bpm="120"))
    tags = ID3(path)
    assert tags["TCON"].text == ["Techno"]
    assert tags["TKEY"].text == ["Am"]
    assert tags["TBPM"].text == ["120"]
