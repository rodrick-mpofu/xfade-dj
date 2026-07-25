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


def analyze_file(path: str) -> AnalysisResult:
    """Extract BPM, key, and energy from an audio file on disk.

    Raises if the file cannot be decoded or analysed; the caller turns that into a
    ``failed`` extraction record.
    """
    import essentia.standard as es  # noqa: PLC0415 — see module docstring

    audio = es.MonoLoader(filename=path, sampleRate=SAMPLE_RATE)()
    if len(audio) == 0:
        raise ValueError("Decoded audio is empty.")

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
            "duration_seconds": round(len(audio) / SAMPLE_RATE, 2),
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
