"""Duration guard and energy calibration.

Essentia is never imported here — `ensure_analysable` and `compute_energy` are
deliberately separate from `analyze_file` so this runs on a Windows host, where
Essentia has no wheel.

The thresholds come from measurement, not taste: on a real DJ library the one-shots
ran 3.5-6.6 seconds and the shortest actual track was 137, so 30 sits in a wide
empty gap.
"""

import pytest

from app.services.audio_analysis import (
    MIN_DURATION_SECONDS,
    compute_energy,
    ensure_analysable,
)


@pytest.mark.parametrize("duration", [137.0, 183.0, 244.9, 489.7, 30.0, 31.5])
def test_real_track_lengths_are_accepted(duration):
    ensure_analysable(duration)  # must not raise


@pytest.mark.parametrize("duration", [3.5, 6.0, 6.6, 29.9, 15.0])
def test_one_shot_lengths_are_rejected(duration):
    # Measured durations of an airhorn, a siren and a subdrop from a real library.
    with pytest.raises(ValueError, match="Too short"):
        ensure_analysable(duration)


def test_the_boundary_is_inclusive():
    ensure_analysable(MIN_DURATION_SECONDS)
    with pytest.raises(ValueError):
        ensure_analysable(MIN_DURATION_SECONDS - 0.1)


@pytest.mark.parametrize("duration", [0.0, -1.0])
def test_empty_audio_is_reported_separately(duration):
    # A failed decode and a too-short file are different problems; the error
    # message is the only thing the user sees on the track page.
    with pytest.raises(ValueError, match="empty"):
        ensure_analysable(duration)


def test_the_message_names_both_the_actual_and_required_length():
    with pytest.raises(ValueError) as caught:
        ensure_analysable(6.6)

    message = str(caught.value)
    assert "6.6" in message
    assert "30" in message


# --- energy -----------------------------------------------------------------
#
# Components measured off real files from the library the calibration was derived
# from, so these pin the mapping to actual audio rather than to invented numbers.
# Regenerating the constants without regenerating these will fail loudly, which is
# the point.

MEASURED = {
    # Jazzworx, MaWhoo & Thukuthela — Uzizwa Kanjan: mellow amapiano, the floor.
    "quietest_groove": ((-13.2306, 1971.28, 3.7086), 0.000),
    # DJames — Love Me
    "low": ((-9.5983, 2166.07, 3.7925), 0.218),
    # Burna Boy — Bundle By Bundle: the library's median track
    "median": ((-10.6930, 2942.50, 5.5434), 0.544),
    # Zack Knight & Jasmin Walia — Bom Diggy
    "high": ((-7.8017, 4216.44, 4.7274), 0.802),
    # Masego & FKJ — Tadow (Omar Remix): loud, bright and busy at once
    "highest": ((-5.2026, 4643.88, 7.3680), 1.000),
}


@pytest.mark.parametrize(("label", "case"), MEASURED.items())
def test_real_tracks_land_where_they_were_measured(label, case):
    (lufs, centroid, onsets), expected = case
    energy = compute_energy(loudness_lufs=lufs, spectral_centroid_hz=centroid, onset_rate=onsets)
    assert energy == pytest.approx(expected, abs=0.005)


def test_the_library_spans_the_scale():
    # The complaint that prompted this: RMS used 0.12-0.42 of a 0-1 field.
    energies = [
        compute_energy(loudness_lufs=lufs, spectral_centroid_hz=centroid, onset_rate=onsets)
        for (lufs, centroid, onsets), _ in MEASURED.values()
    ]
    assert min(energies) < 0.05
    assert max(energies) > 0.95


def test_loudness_alone_cannot_produce_a_high_score():
    """The whole point: a loud track that is dark and sparse is not high energy.

    Under RMS this track would have scored near the top of the range.
    """
    energy = compute_energy(loudness_lufs=0.0, spectral_centroid_hz=0.0, onset_rate=0.0)
    assert energy < 0.4


def test_a_track_must_be_high_on_all_three_axes_to_max_out():
    two_of_three = compute_energy(loudness_lufs=0.0, spectral_centroid_hz=99_999.0, onset_rate=0.0)
    all_three = compute_energy(loudness_lufs=0.0, spectral_centroid_hz=99_999.0, onset_rate=99.0)
    assert two_of_three < 0.8
    assert all_three == 1.0


@pytest.mark.parametrize(
    ("component", "low", "high"),
    [
        ("loudness_lufs", -20.0, -6.0),
        ("spectral_centroid_hz", 2000.0, 4500.0),
        ("onset_rate", 3.8, 6.4),
    ],
)
def test_each_component_increases_energy_on_its_own(component, low, high):
    baseline = {"loudness_lufs": -11.0, "spectral_centroid_hz": 3000.0, "onset_rate": 4.8}
    quiet = compute_energy(**{**baseline, component: low})
    loud = compute_energy(**{**baseline, component: high})
    assert loud > quiet


@pytest.mark.parametrize(
    "components",
    [
        (-1000.0, -50.0, -5.0),  # below every range
        (1000.0, 1e9, 1e6),  # above every range
    ],
)
def test_values_outside_the_calibrated_range_clamp(components):
    lufs, centroid, onsets = components
    energy = compute_energy(loudness_lufs=lufs, spectral_centroid_hz=centroid, onset_rate=onsets)
    assert 0.0 <= energy <= 1.0
