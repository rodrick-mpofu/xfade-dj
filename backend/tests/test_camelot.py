import pytest

from app.core.camelot import to_camelot

# The canonical wheel. Getting one of these wrong makes the compatibility score
# confidently wrong rather than obviously broken, so all 24 are pinned.
MAJOR = [
    ("C", "8B"),
    ("G", "9B"),
    ("D", "10B"),
    ("A", "11B"),
    ("E", "12B"),
    ("B", "1B"),
    ("F#", "2B"),
    ("C#", "3B"),
    ("G#", "4B"),
    ("D#", "5B"),
    ("A#", "6B"),
    ("F", "7B"),
]

MINOR = [
    ("A", "8A"),
    ("E", "9A"),
    ("B", "10A"),
    ("F#", "11A"),
    ("C#", "12A"),
    ("G#", "1A"),
    ("D#", "2A"),
    ("A#", "3A"),
    ("F", "4A"),
    ("C", "5A"),
    ("G", "6A"),
    ("D", "7A"),
]


@pytest.mark.parametrize(("key", "expected"), MAJOR)
def test_major_keys_map_to_the_b_side(key, expected):
    assert to_camelot(key, "major") == expected


@pytest.mark.parametrize(("key", "expected"), MINOR)
def test_minor_keys_map_to_the_a_side(key, expected):
    assert to_camelot(key, "minor") == expected


def test_every_code_on_the_wheel_is_distinct():
    codes = {to_camelot(key, "major") for key, _ in MAJOR}
    codes |= {to_camelot(key, "minor") for key, _ in MINOR}
    assert len(codes) == 24


@pytest.mark.parametrize(
    ("sharp", "flat"),
    [("C#", "Db"), ("D#", "Eb"), ("F#", "Gb"), ("G#", "Ab"), ("A#", "Bb")],
)
def test_enharmonic_spellings_agree(sharp, flat):
    # Essentia reports sharps, but flats must not silently fall through to None.
    assert to_camelot(sharp, "major") == to_camelot(flat, "major")
    assert to_camelot(sharp, "minor") == to_camelot(flat, "minor")


@pytest.mark.parametrize("scale", ["MAJOR", "Major", "minor", "MINOR"])
def test_scale_is_case_insensitive(scale):
    assert to_camelot("C", scale) is not None


def test_lowercase_key_names_are_accepted():
    assert to_camelot("f#", "minor") == "11A"


@pytest.mark.parametrize(
    ("key", "scale"),
    [
        (None, "major"),
        ("C", None),
        ("", "major"),
        ("H", "major"),  # not a note name
        ("C", "dorian"),  # modal scale, no Camelot equivalent
        ("C", ""),
    ],
)
def test_unrecognised_input_returns_none(key, scale):
    # None must mean "no answer", never a plausible-looking wrong code.
    assert to_camelot(key, scale) is None
