"""Rules-based compatibility scoring — build spec §5, design doc §5.

Deliberately not ML. Two tracks get a 0-100 score from the Camelot wheel and their
tempo difference, computed on the fly with no stored model and no dependency on
anything but the two feature rows.

The weights and thresholds below are conventional DJ heuristics, not learned or
validated values. They are gathered here as named constants so they are easy to
argue with and adjust; the v2 recommendation work is where evidence starts
replacing judgement.
"""

from dataclasses import dataclass
from typing import Literal

from app.core.camelot import pitch_class_of

# Key clashes are audible and hard to fix mid-mix; a few BPM is correctable with the
# pitch fader or sync. So harmony carries more of the score than tempo does.
HARMONIC_WEIGHT = 0.6
TEMPO_WEIGHT = 0.4

# Tempo difference as a percentage of the slower track, and the score at each edge.
# ~3% is roughly what a pitch fader absorbs without audible artefacts.
TEMPO_PERFECT_PERCENT = 3.0
TEMPO_USABLE_PERCENT = 8.0
TEMPO_USABLE_SCORE = 0.4

# A 65 BPM track mixes happily with a 130 BPM one. Ratios near 2 are treated as a
# match on the halved/doubled tempo rather than a 100% error.
DOUBLE_TIME_TOLERANCE = 0.06

HarmonicRelation = Literal[
    "identical",
    "adjacent",
    "relative",
    "energy_boost",
    "semitone",
    "diagonal",
    "clash",
]

# Camelot relation -> harmonic score. Distances are circular on the 1-12 wheel.
#
# Wheel numbers are the circle of fifths, so a distance of n is n perfect fifths,
# which is 7n semitones once it wraps:
#
#   1 -> 7 semitones (a fifth)        the standard smooth move
#   2 -> 2 semitones (a whole tone)   a deliberate lift
#   5 -> 1 semitone                   the "+7" move; see below
#   6 -> 6 semitones (a tritone)      genuinely a clash
#
_SAME_LETTER_SCORES: dict[int, tuple[float, HarmonicRelation]] = {
    0: (1.0, "identical"),  # same key
    1: (0.9, "adjacent"),  # neighbour on the wheel, the standard smooth move
    2: (0.6, "energy_boost"),  # +2 lift; works, but it is a deliberate jump
    # Five steps round the wheel is a single semitone — the move DJs reach for by
    # adding 7 to the Camelot number (6A + 7 = 13 -> 1A, G minor to G# minor).
    # It used to fall through to "clash" alongside the tritone, which conflated a
    # technique with a mistake. It is not *harmonically* close — a semitone apart
    # shares almost no notes, and a long blend will sound wrong — so it scores as
    # deliberate rather than smooth.
    5: (0.5, "semitone"),
}
_CROSS_LETTER_SCORES: dict[int, tuple[float, HarmonicRelation]] = {
    0: (0.85, "relative"),  # relative major/minor, e.g. 8A <-> 8B
    1: (0.5, "diagonal"),  # e.g. 8A -> 9B; usable, less reliable
}
_CLASH = (0.15, "clash")


@dataclass(frozen=True)
class TrackFeatures:
    """The only inputs scoring needs. Keeps this module free of DB concerns."""

    bpm: float
    key_camelot: str


@dataclass(frozen=True)
class HarmonicResult:
    score: float
    relation: HarmonicRelation
    track_a_key: str
    track_b_key: str


@dataclass(frozen=True)
class TempoResult:
    score: float
    track_a_bpm: float
    track_b_bpm: float
    delta_bpm: float
    delta_percent: float
    double_time: bool


@dataclass(frozen=True)
class CompatibilityResult:
    score: int
    harmonic: HarmonicResult
    tempo: TempoResult
    notes: list[str]


def parse_camelot(code: str) -> tuple[int, str] | None:
    """'8A' -> (8, 'A'). Returns None for anything malformed."""
    if not code or len(code) < 2:
        return None
    number, letter = code[:-1], code[-1].upper()
    if letter not in ("A", "B") or not number.isdigit():
        return None
    value = int(number)
    return (value, letter) if 1 <= value <= 12 else None


def _wheel_distance(a: int, b: int) -> int:
    """Shortest distance around the 12-hour wheel, so 12 and 1 are neighbours."""
    raw = abs(a - b)
    return min(raw, 12 - raw)


def score_harmonic(key_a: str, key_b: str) -> HarmonicResult:
    parsed_a, parsed_b = parse_camelot(key_a), parse_camelot(key_b)
    if parsed_a is None or parsed_b is None:
        raise ValueError(f"Unparseable Camelot code: {key_a!r} / {key_b!r}")

    (number_a, letter_a), (number_b, letter_b) = parsed_a, parsed_b
    distance = _wheel_distance(number_a, number_b)
    table = _SAME_LETTER_SCORES if letter_a == letter_b else _CROSS_LETTER_SCORES
    score, relation = table.get(distance, _CLASH)

    return HarmonicResult(score=score, relation=relation, track_a_key=key_a, track_b_key=key_b)


def score_tempo(bpm_a: float, bpm_b: float) -> TempoResult:
    if bpm_a <= 0 or bpm_b <= 0:
        raise ValueError("BPM must be positive.")

    # Compare against the halved/doubled tempo when that is the closer reading.
    comparison_b, double_time = bpm_b, False
    for candidate in (bpm_b * 2, bpm_b / 2):
        if abs(candidate - bpm_a) < abs(comparison_b - bpm_a):
            ratio = max(candidate, bpm_a) / min(candidate, bpm_a)
            if ratio - 1 <= DOUBLE_TIME_TOLERANCE:
                comparison_b, double_time = candidate, True

    delta = abs(bpm_a - comparison_b)
    delta_percent = delta / min(bpm_a, comparison_b) * 100

    if delta_percent <= TEMPO_PERFECT_PERCENT:
        score = 1.0
    elif delta_percent >= TEMPO_USABLE_PERCENT:
        # Falls away past the usable band rather than hitting zero: a big tempo gap
        # is a judgement call, not an impossibility.
        score = max(0.0, TEMPO_USABLE_SCORE - (delta_percent - TEMPO_USABLE_PERCENT) / 40)
    else:
        span = TEMPO_USABLE_PERCENT - TEMPO_PERFECT_PERCENT
        progress = (delta_percent - TEMPO_PERFECT_PERCENT) / span
        score = 1.0 - progress * (1.0 - TEMPO_USABLE_SCORE)

    return TempoResult(
        score=round(score, 4),
        track_a_bpm=bpm_a,
        track_b_bpm=bpm_b,
        delta_bpm=round(abs(bpm_a - bpm_b), 2),
        delta_percent=round(delta_percent, 2),
        double_time=double_time,
    )


def _semitone_direction(key_a: str, key_b: str) -> str:
    """'A semitone up' or 'down' — the wheel distance is 5 either way.

    Combos are directional (A into B), so this is worth getting right: a lift up is
    the move people mean, and dropping a semitone is a different, rarer choice.
    """
    pitch_a, pitch_b = pitch_class_of(key_a), pitch_class_of(key_b)
    if pitch_a is None or pitch_b is None:
        return "A semitone apart"
    return "A semitone up" if (pitch_b - pitch_a) % 12 == 1 else "A semitone down"


def score_compatibility(a: TrackFeatures, b: TrackFeatures) -> CompatibilityResult:
    harmonic = score_harmonic(a.key_camelot, b.key_camelot)
    tempo = score_tempo(a.bpm, b.bpm)

    combined = harmonic.score * HARMONIC_WEIGHT + tempo.score * TEMPO_WEIGHT

    notes: list[str] = []
    if harmonic.relation == "identical":
        notes.append("Same key — harmonically seamless.")
    elif harmonic.relation == "adjacent":
        notes.append("Neighbouring keys on the Camelot wheel.")
    elif harmonic.relation == "relative":
        notes.append("Relative major/minor — same root, different mood.")
    elif harmonic.relation == "energy_boost":
        notes.append("Two steps up the wheel — a deliberate energy lift.")
    elif harmonic.relation == "semitone":
        notes.append(
            f"{_semitone_direction(a.key_camelot, b.key_camelot)} — the +7 move. "
            "A deliberate lift: cut or drop into it rather than blending long."
        )
    elif harmonic.relation == "diagonal":
        notes.append("Diagonal move — usable, but less reliable.")
    else:
        notes.append("Keys clash; consider an EQ-heavy or percussive transition.")

    if tempo.double_time:
        notes.append("Tempos match at double/half time.")
    if tempo.delta_percent > TEMPO_USABLE_PERCENT:
        notes.append(f"Tempo gap of {tempo.delta_percent:.1f}% needs a big pitch change.")

    return CompatibilityResult(
        score=round(combined * 100),
        harmonic=harmonic,
        tempo=tempo,
        notes=notes,
    )
