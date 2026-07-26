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

# Frame geometry for the spectral pass. These are not free parameters: the energy
# ranges below were calibrated against a run using exactly this framing, so changing
# them shifts every centroid and invalidates the calibration.
FRAME_SIZE = 2048
HOP_SIZE = 1024

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

# Energy is a composite of three measures, one per independent axis. Which three was
# decided by measurement rather than taste: eleven candidates were computed over the
# whole 235-track library and the rank correlations between them fell into clusters.
#
#   Loudness      rms, lufs, loudness_vickers and spectral flux all correlate
#                 0.68-0.90 with each other, and inversely with dynamic complexity
#                 (-0.45) and loudness range (-0.28). Flux looks like a measure of
#                 drive and is not — at 0.85 against lufs it is loudness in disguise.
#                 LUFS represents the cluster: perceptually weighted, standard scale.
#   Brightness    centroid, rolloff and high-band ratio correlate 0.82-0.96 with each
#                 other and only -0.12 to -0.33 with loudness, so this is genuinely
#                 separate information. Centroid represents it.
#   Activity      onset rate is near-uncorrelated with loudness (-0.03). It does
#                 correlate 0.52 with tagged BPM, so energy inherits some tempo —
#                 defensible, but see backlog §2.
#
# Equal weights, because there is no labelled energy data to fit anything better.
#
# Each component is mapped to 0-1 across the 5th-95th percentile of the library, then
# averaged. Averaging near-independent variables pulls the result to the middle, so
# the mean is stretched over its own measured percentiles afterwards — without that
# second step the composite re-clusters exactly the way RMS did.
#
# These bounds therefore describe *this library*: energy is "energetic relative to
# what I play", not an absolute physical scale. For a single-user tool that is the
# more useful of the two readings, but it is a calibration, and re-deriving it is
# what the raw components in structure_markers are for.
_ENERGY_RANGES: dict[str, tuple[float, float]] = {
    "loudness_lufs": (-14.25, -7.31),
    "spectral_centroid_hz": (1950.77, 4714.74),
    "onset_rate": (3.70, 6.51),
}
# Wider than the components' 5th-95th, on purpose. Stretching the mean over its own
# p05/p95 pinned 12 tracks at each end — the same loss of discrimination this change
# exists to fix, just relocated. p01/p99 leaves 3 per end, and the ordering is
# identical either way (rank correlation 1.000), so only the tails are affected.
_ENERGY_COMPOSITE_RANGE = (0.0948, 0.8559)


@dataclass(frozen=True)
class AnalysisResult:
    bpm: float
    key_camelot: str | None
    energy: float
    danceability: float | None
    duration_seconds: float
    structure_markers: dict[str, Any]


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _rescale(value: float, bounds: tuple[float, float]) -> float:
    low, high = bounds
    if high == low:
        return 0.0
    return _clamp((value - low) / (high - low))


def compute_energy(
    *, loudness_lufs: float, spectral_centroid_hz: float, onset_rate: float
) -> float:
    """Combine the three measured components into a 0-1 energy.

    Separate from :func:`analyze_file`, and taking plain floats, so the calibration
    is testable on a Windows host where Essentia will not import.
    """
    components = {
        "loudness_lufs": loudness_lufs,
        "spectral_centroid_hz": spectral_centroid_hz,
        "onset_rate": onset_rate,
    }
    parts = [_rescale(components[name], bounds) for name, bounds in _ENERGY_RANGES.items()]
    return _rescale(sum(parts) / len(parts), _ENERGY_COMPOSITE_RANGE)


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


def _mean_spectral_centroid(es: Any, audio: Any) -> float:
    """Average spectral centroid in Hz over the whole track.

    Frames are averaged unweighted, silence included. Weighting by frame energy
    would arguably be better, but the calibration ranges were measured this way and
    the two must match.
    """
    window = es.Windowing(type="hann")
    spectrum = es.Spectrum()
    centroid = es.Centroid(range=SAMPLE_RATE / 2)

    total = 0.0
    frames = 0
    for frame in es.FrameGenerator(
        audio, frameSize=FRAME_SIZE, hopSize=HOP_SIZE, startFromZero=True
    ):
        total += float(centroid(spectrum(window(frame))))
        frames += 1
    return total / frames if frames else 0.0


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

    # LoudnessEBUR128 only accepts a stereo signal. Duplicating the mono channel
    # adds a constant offset to every track, which the calibration absorbs.
    stereo = es.StereoMuxer()(audio, audio)
    _, _, loudness_lufs, _ = es.LoudnessEBUR128(sampleRate=SAMPLE_RATE)(stereo)

    spectral_centroid_hz = _mean_spectral_centroid(es, audio)
    _, onset_rate = es.OnsetRate()(audio)

    energy = compute_energy(
        loudness_lufs=float(loudness_lufs),
        spectral_centroid_hz=spectral_centroid_hz,
        onset_rate=float(onset_rate),
    )

    danceability_raw, _ = es.Danceability()(audio)
    danceability = _clamp(float(danceability_raw) / _DANCEABILITY_SCALE)

    return AnalysisResult(
        bpm=round(float(bpm), 2),
        key_camelot=key_camelot,
        energy=round(energy, 4),
        danceability=round(danceability, 4),
        duration_seconds=round(duration_seconds, 2),
        structure_markers={
            "duration_seconds": round(duration_seconds, 2),
            "beat_count": int(len(beats)),
            "beats_confidence": round(float(beats_confidence), 4),
            # The energy components, raw. Kept so the calibration above can be
            # re-derived from stored rows rather than by re-running extraction over
            # the library, and so a surprising energy is explainable.
            "loudness_lufs": round(float(loudness_lufs), 4),
            "spectral_centroid_hz": round(spectral_centroid_hz, 2),
            "onset_rate": round(float(onset_rate), 4),
            # The measure energy used to be, kept for comparison. Cheap to compute.
            "rms": round(float(es.RMS()(audio)), 4),
            # Kept raw alongside the Camelot code so a mapping bug is diagnosable
            # after the fact without re-running extraction.
            "key_raw": key,
            "scale": scale,
            "key_strength": round(float(key_strength), 4),
            "sample_rate": SAMPLE_RATE,
        },
    )
