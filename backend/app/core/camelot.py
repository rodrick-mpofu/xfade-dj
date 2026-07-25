"""Musical key -> Camelot wheel notation.

The Camelot code is what the compatibility rules (design doc §5) actually operate
on, so this is the bridge between what Essentia reports and what step 5 consumes.

Mapping goes through pitch class rather than key-name string matching: Essentia
reports sharps ("A#") but enharmonic flats ("Bb") mean the same key, and a
name-keyed table silently misses half of them.
"""

_PITCH_CLASSES: dict[str, int] = {
    "C": 0,
    "B#": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "Fb": 4,
    "F": 5,
    "E#": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
    "Cb": 11,
}

# B side of the wheel.
_MAJOR: dict[int, str] = {
    0: "8B",
    7: "9B",
    2: "10B",
    9: "11B",
    4: "12B",
    11: "1B",
    6: "2B",
    1: "3B",
    8: "4B",
    3: "5B",
    10: "6B",
    5: "7B",
}

# A side of the wheel.
_MINOR: dict[int, str] = {
    9: "8A",
    4: "9A",
    11: "10A",
    6: "11A",
    1: "12A",
    8: "1A",
    3: "2A",
    10: "3A",
    5: "4A",
    0: "5A",
    7: "6A",
    2: "7A",
}


def to_camelot(key: str | None, scale: str | None) -> str | None:
    """Convert a key name plus 'major'/'minor' to a Camelot code.

    Returns ``None`` for anything unrecognised — the caller decides whether that
    is a failed extraction, rather than getting a plausible-looking wrong answer.
    """
    if not key or not scale:
        return None

    pitch_class = _PITCH_CLASSES.get(key.strip().capitalize())
    if pitch_class is None:
        # Essentia can report modal scales beyond major/minor depending on profile.
        pitch_class = _PITCH_CLASSES.get(key.strip())
    if pitch_class is None:
        return None

    normalised_scale = scale.strip().lower()
    if normalised_scale == "major":
        return _MAJOR[pitch_class]
    if normalised_scale == "minor":
        return _MINOR[pitch_class]
    return None
