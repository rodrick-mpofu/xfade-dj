"""Scoring uses the effective values — tag first, analysis second.

The generated columns do the resolving in the database; these tests pin that the
endpoints actually read them, and that a track with tags is usable before extraction
has finished.
"""

from tests.conftest import TEST_USER_ID
from tests.fakes import FakeSupabase

TRACK_A = "22222222-2222-4222-8222-222222222222"
TRACK_B = "33333333-3333-4333-8333-333333333333"


def _track(track_id, *, status="complete", bpm=128.0, key="8A", tag_bpm=None, tag_key=None):
    effective_bpm = tag_bpm if tag_bpm is not None else bpm
    effective_key = tag_key if tag_key is not None else key
    return {
        "id": track_id,
        "user_id": TEST_USER_ID,
        "title": f"Track {track_id[:4]}",
        "artist": None,
        "genre": None,
        "file_ref": None,
        "source": "upload",
        "created_at": "2026-07-26T12:00:00Z",
        "audio_features": {
            "track_id": track_id,
            "status": status,
            "bpm": bpm,
            "key_camelot": key,
            "bpm_tag": tag_bpm,
            "key_camelot_tag": tag_key,
            "bpm_effective": effective_bpm,
            "key_camelot_effective": effective_key,
            "energy": 0.3,
            "danceability": 0.4,
            "duration_seconds": 210.0,
            "structure_markers": None,
            "error_message": None,
            "analyzed_at": None,
        },
    }


def _pair(a, b):
    return FakeSupabase(rows={"tracks": [a, b]})


def _score(client, fake):
    return client(fake).get("/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_B})


def test_the_tag_key_wins_over_the_analysed_one(authed_client):
    # Essentia says 8A for both, which would be "identical". The tags say the second
    # is really 2B — a clash. The score must follow the tags.
    fake = _pair(
        _track(TRACK_A, key="8A"),
        _track(TRACK_B, key="8A", tag_key="2B"),
    )

    body = _score(authed_client, fake).json()

    assert body["harmonic"]["track_b_key"] == "2B"
    assert body["harmonic"]["relation"] == "clash"


def test_analysis_is_used_when_the_file_has_no_tags(authed_client):
    fake = _pair(_track(TRACK_A, key="8A"), _track(TRACK_B, key="9A"))

    body = _score(authed_client, fake).json()

    assert body["harmonic"]["track_b_key"] == "9A"
    assert body["harmonic"]["relation"] == "adjacent"


def test_a_pending_track_with_tags_is_scoreable(authed_client):
    # The whole point of reading tags at upload: a score before Essentia finishes.
    fake = _pair(
        _track(TRACK_A, key="8A"),
        _track(TRACK_B, status="pending", bpm=None, key=None, tag_bpm=128.0, tag_key="8B"),
    )

    body = _score(authed_client, fake).json()

    assert body["status"] == "ok"
    assert body["harmonic"]["relation"] == "relative"


def test_a_pending_track_without_tags_still_reports_pending(authed_client):
    fake = _pair(
        _track(TRACK_A, key="8A"),
        _track(TRACK_B, status="pending", bpm=None, key=None),
    )

    assert _score(authed_client, fake).json()["status"] == "pending_extraction"


def test_a_failed_track_with_tags_is_still_scoreable(authed_client):
    # Analysis failing does not invalidate what the file says about itself.
    fake = _pair(
        _track(TRACK_A, key="8A"),
        _track(TRACK_B, status="failed", bpm=None, key=None, tag_bpm=130.0, tag_key="8A"),
    )

    body = _score(authed_client, fake).json()

    assert body["status"] == "ok"
    assert body["harmonic"]["relation"] == "identical"


def test_a_failed_track_without_tags_reports_the_failure(authed_client):
    fake = _pair(
        _track(TRACK_A, key="8A"),
        _track(TRACK_B, status="failed", bpm=None, key=None),
    )

    assert _score(authed_client, fake).json()["status"] == "extraction_failed"


def test_suggestions_rank_on_the_effective_key(authed_client):
    fake = FakeSupabase(
        rows={
            "tracks": [
                _track(TRACK_A, key="8A"),
                # Analysis says 8A (a perfect match); the tag says otherwise.
                _track(TRACK_B, key="8A", tag_key="2B"),
                _track("44444444-4444-4444-8444-444444444444", key="8A"),
            ]
        }
    )

    body = authed_client(fake).get(f"/tracks/{TRACK_A}/compatible").json()

    assert body[0]["harmonic"]["track_b_key"] == "8A"
    assert body[-1]["harmonic"]["track_b_key"] == "2B"


def test_suggestions_include_a_pending_track_that_has_tags(authed_client):
    fake = FakeSupabase(
        rows={
            "tracks": [
                _track(TRACK_A, key="8A"),
                _track(TRACK_B, status="pending", bpm=None, key=None, tag_bpm=128.0, tag_key="9A"),
            ]
        }
    )

    body = authed_client(fake).get(f"/tracks/{TRACK_A}/compatible").json()

    assert [item["harmonic"]["track_b_key"] for item in body] == ["9A"]
