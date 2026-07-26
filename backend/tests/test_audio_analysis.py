"""Duration guard.

Essentia is never imported here — `ensure_analysable` is deliberately separate from
`analyze_file` so this runs on a Windows host, where Essentia has no wheel.

The thresholds come from measurement, not taste: on a real DJ library the one-shots
ran 3.5-6.6 seconds and the shortest actual track was 137, so 30 sits in a wide
empty gap.
"""

import pytest

from app.services.audio_analysis import MIN_DURATION_SECONDS, ensure_analysable


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
