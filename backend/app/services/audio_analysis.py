"""Essentia feature extraction — the actual DSP.

Kept free of database and Storage concerns so it can be exercised against a local
file, and so :mod:`app.services.extraction` stays readable as orchestration.

Essentia is imported lazily inside :func:`analyze_file`. It publishes no Windows
wheels (only an sdist needing a full C++ toolchain), so on a Windows dev box the
rest of the app — and the whole test suite — still imports cleanly; only this one
call fails. Run it via Docker, per README.
"""

import logging
from dataclasses import dataclass
from typing import Any

from app.core.camelot import to_camelot

logger = logging.getLogger("xfade.analysis")

SAMPLE_RATE = 44100

# A DJ library holds one-shots — airhorns, sirens, drops — alongside tracks, and
# Essentia answers for them just as confidently as for real music. Measured on a
# real library: one-shots ran 3.5-6.6s, actual tracks 137-490s, so duration
# separates them with a wide margin where confidence does not (an airhorn scored
# beats_confidence 4.13, higher than every real track in the sample).
#
# Refusing to analyse is better than storing a fabricated BPM and key, which would
# otherwise feed the compatibility score as if it meant something.
MIN_DURATION_SECONDS = 30.0

# Essentia's Danceability is roughly 0-3; the column is constrained to 0-1.
#
# Provisional, and known to be crude: a synthetic 120 BPM click track already
# saturates this at 1.0, so the divisor is a placeholder rather than a calibrated
# mapping. Left as-is because nothing in v1 reads danceability — the compatibility
# score (build spec §5) uses Camelot and BPM only. Calibrate against real tracks
# before anything depends on it.
_DANCEABILITY_SCALE = 3.0


@dataclass(frozen=True)
class AnalysisResult:
    bpm: float
    key_camelot: str | None
    energy: float
    danceability: float | None
    structure_markers: dict[str, Any]


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ensure_analysable(duration_seconds: float) -> None:
    """Reject audio too short to have a meaningful tempo or key.

    Split out from :func:`analyze_file` so it is testable without Essentia, which
    has no Windows wheels.
    """
    if duration_seconds <= 0:
        raise ValueError("Decoded audio is empty.")
    if duration_seconds < MIN_DURATION_SECONDS:
        raise ValueError(
            f"Too short to analyse: {duration_seconds:.1f}s, minimum "
            f"{MIN_DURATION_SECONDS:.0f}s. One-shots and drops have no tempo or key."
        )


def analyze_file(path: str) -> AnalysisResult:
    """Extract BPM, key, and energy from an audio file on disk.

    Raises if the file cannot be decoded or analysed; the caller turns that into a
    ``failed`` extraction record.
    """
    import essentia.standard as es  # noqa: PLC0415 — see module docstring

    audio = es.MonoLoader(filename=path, sampleRate=SAMPLE_RATE)()

    # Checked before the expensive beat tracking below, so a rejected one-shot
    # costs a decode rather than a full analysis.
    duration_seconds = len(audio) / SAMPLE_RATE
    ensure_analysable(duration_seconds)

    # multifeature is the slower, more accurate of the RhythmExtractor2013 methods.
    # Beat tracking is the expensive part of this function; it is why extraction is
    # a background job rather than inline in the upload request.
    bpm, beats, beats_confidence, _, _ = es.RhythmExtractor2013(method="multifeature")(audio)

    key, scale, key_strength = es.KeyExtractor()(audio)
    key_camelot = to_camelot(key, scale)
    if key_camelot is None:
        logger.warning("unmapped key from essentia: key=%r scale=%r", key, scale)

    # RMS over normalised audio is already in [0, 1]. A crude stand-in for what a DJ
    # means by "energy" — it tracks loudness, not intensity or drive — but it is
    # well-defined and stable, which matters more than sophistication at v1.
    energy = _clamp(float(es.RMS()(audio)))

    danceability_raw, _ = es.Danceability()(audio)
    danceability = _clamp(float(danceability_raw) / _DANCEABILITY_SCALE)

    return AnalysisResult(
        bpm=round(float(bpm), 2),
        key_camelot=key_camelot,
        energy=round(energy, 4),
        danceability=round(danceability, 4),
        structure_markers={
            "duration_seconds": round(duration_seconds, 2),
            "beat_count": int(len(beats)),
            "beats_confidence": round(float(beats_confidence), 4),
            # Kept raw alongside the Camelot code so a mapping bug is diagnosable
            # after the fact without re-running extraction.
            "key_raw": key,
            "scale": scale,
            "key_strength": round(float(key_strength), 4),
            "sample_rate": SAMPLE_RATE,
        },
    )
