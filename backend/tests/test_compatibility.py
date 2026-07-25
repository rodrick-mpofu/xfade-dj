import pytest

from app.core.compatibility import (
    HARMONIC_WEIGHT,
    TEMPO_WEIGHT,
    TrackFeatures,
    parse_camelot,
    score_compatibility,
    score_harmonic,
    score_tempo,
)

# --- parsing ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("code", "expected"),
    [("8A", (8, "A")), ("12B", (12, "B")), ("1a", (1, "A")), ("10b", (10, "B"))],
)
def test_valid_codes_parse(code, expected):
    assert parse_camelot(code) == expected


@pytest.mark.parametrize("code", ["", "A", "0A", "13A", "8C", "8", "AA", "-1A", "8AB"])
def test_invalid_codes_return_none(code):
    assert parse_camelot(code) is None


# --- harmonic ---------------------------------------------------------------


def test_same_key_is_a_perfect_match():
    result = score_harmonic("8A", "8A")
    assert result.score == 1.0
    assert result.relation == "identical"


@pytest.mark.parametrize(("a", "b"), [("8A", "9A"), ("8A", "7A"), ("12A", "1A"), ("1A", "12A")])
def test_neighbours_score_high_including_across_the_wrap(a, b):
    # 12 and 1 are adjacent on the wheel; treating them as 11 apart is the classic bug.
    result = score_harmonic(a, b)
    assert result.relation == "adjacent"
    assert result.score == 0.9


def test_relative_major_minor_scores_high():
    result = score_harmonic("8A", "8B")
    assert result.relation == "relative"


def test_two_steps_is_an_energy_boost():
    assert score_harmonic("8A", "10A").relation == "energy_boost"


def test_distant_keys_clash():
    result = score_harmonic("8A", "2A")
    assert result.relation == "clash"
    assert result.score < 0.3


def test_harmonic_scoring_is_symmetric():
    for a, b in [("8A", "9A"), ("8A", "8B"), ("12B", "1B"), ("3A", "9A")]:
        assert score_harmonic(a, b).score == score_harmonic(b, a).score


def test_unparseable_key_raises():
    with pytest.raises(ValueError):
        score_harmonic("8A", "nonsense")


# --- tempo ------------------------------------------------------------------


def test_identical_tempo_is_perfect():
    assert score_tempo(128.0, 128.0).score == 1.0


def test_small_difference_stays_perfect():
    # Within what a pitch fader absorbs.
    assert score_tempo(128.0, 130.0).score == 1.0


def test_score_decreases_as_the_gap_widens():
    scores = [score_tempo(128.0, other).score for other in (128.0, 133.0, 138.0, 160.0)]
    assert scores == sorted(scores, reverse=True)
    assert scores[0] > scores[-1]


def test_double_time_is_recognised():
    result = score_tempo(70.0, 140.0)
    assert result.double_time is True
    assert result.score == 1.0
    # The reported delta stays honest about the raw numbers.
    assert result.delta_bpm == 70.0


def test_half_time_is_recognised():
    assert score_tempo(140.0, 70.0).double_time is True


def test_a_near_double_that_is_out_of_tolerance_is_not_treated_as_double_time():
    result = score_tempo(128.0, 300.0)
    assert result.double_time is False
    assert result.score < 0.4


def test_tempo_score_never_leaves_the_unit_range():
    for a, b in [(60.0, 200.0), (128.0, 129.0), (90.0, 180.0), (100.0, 101.0), (70.0, 350.0)]:
        assert 0.0 <= score_tempo(a, b).score <= 1.0


def test_non_positive_bpm_raises():
    with pytest.raises(ValueError):
        score_tempo(0.0, 128.0)


# --- combined ---------------------------------------------------------------


def test_perfect_pair_scores_100():
    result = score_compatibility(
        TrackFeatures(bpm=128.0, key_camelot="8A"),
        TrackFeatures(bpm=128.0, key_camelot="8A"),
    )
    assert result.score == 100


def test_worst_case_scores_low_but_not_zero():
    # A clash is a judgement call, not an impossibility.
    result = score_compatibility(
        TrackFeatures(bpm=100.0, key_camelot="8A"),
        TrackFeatures(bpm=140.0, key_camelot="2B"),
    )
    assert 0 < result.score < 25


def test_a_wide_gap_that_resolves_at_half_time_is_not_penalised():
    # 175 halved is 87.5, within a few percent of 90 — genuinely mixable, even
    # though the raw numbers look 85 BPM apart. Clashing keys still cap the score.
    result = score_compatibility(
        TrackFeatures(bpm=90.0, key_camelot="8A"),
        TrackFeatures(bpm=175.0, key_camelot="2B"),
    )
    assert result.tempo.double_time is True
    assert result.tempo.score == 1.0
    assert result.harmonic.relation == "clash"
    assert 40 < result.score < 60


def test_weights_are_applied_as_documented():
    # Same key (1.0 harmonic), tempo far enough apart to be well under 1.0.
    result = score_compatibility(
        TrackFeatures(bpm=120.0, key_camelot="8A"),
        TrackFeatures(bpm=132.0, key_camelot="8A"),
    )
    expected = 1.0 * HARMONIC_WEIGHT + result.tempo.score * TEMPO_WEIGHT
    assert result.score == round(expected * 100)


def test_harmony_outweighs_tempo():
    # Same key, mismatched tempo should beat matched tempo with clashing keys —
    # tempo is correctable mid-mix, key is not.
    harmonic_match = score_compatibility(
        TrackFeatures(bpm=120.0, key_camelot="8A"),
        TrackFeatures(bpm=130.0, key_camelot="8A"),
    )
    tempo_match = score_compatibility(
        TrackFeatures(bpm=128.0, key_camelot="8A"),
        TrackFeatures(bpm=128.0, key_camelot="2B"),
    )
    assert harmonic_match.score > tempo_match.score


def test_scoring_is_symmetric():
    a = TrackFeatures(bpm=124.0, key_camelot="9A")
    b = TrackFeatures(bpm=128.0, key_camelot="8B")
    assert score_compatibility(a, b).score == score_compatibility(b, a).score


def test_score_always_lands_in_range():
    keys = ["1A", "5B", "8A", "12B"]
    tempos = [60.0, 90.0, 128.0, 175.0]
    for key_a in keys:
        for key_b in keys:
            for bpm_a in tempos:
                for bpm_b in tempos:
                    result = score_compatibility(
                        TrackFeatures(bpm=bpm_a, key_camelot=key_a),
                        TrackFeatures(bpm=bpm_b, key_camelot=key_b),
                    )
                    assert 0 <= result.score <= 100


def test_notes_explain_the_result():
    result = score_compatibility(
        TrackFeatures(bpm=70.0, key_camelot="8A"),
        TrackFeatures(bpm=140.0, key_camelot="8A"),
    )
    assert any("Same key" in note for note in result.notes)
    assert any("double/half" in note for note in result.notes)
