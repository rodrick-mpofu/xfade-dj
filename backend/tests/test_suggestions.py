"""Harmonic suggestions: rank the library against one track."""

from tests.conftest import TEST_USER_ID
from tests.fakes import FakeSupabase

SOURCE = "11111111-1111-4111-8111-111111111111"


def uid(n: int) -> str:
    """Candidate ids have to be real UUIDs — the response model parses them."""
    return f"{n:08d}-2222-4222-8222-222222222222"


def _track(track_id, title, bpm=128.0, key="8A", status="complete"):
    return {
        "id": track_id,
        "user_id": TEST_USER_ID,
        "title": title,
        "artist": None,
        "genre": None,
        "file_ref": None,
        "source": "upload",
        "created_at": "2026-07-26T12:00:00Z",
        "audio_features": {
            "track_id": track_id,
            "status": status,
            "bpm": bpm if status == "complete" else None,
            "key_camelot": key if status == "complete" else None,
            "energy": 0.3,
            "danceability": 0.4,
            "duration_seconds": 210.0,
            "structure_markers": None,
            "error_message": None,
            "analyzed_at": None,
        },
    }


def _fake(*tracks):
    return FakeSupabase(rows={"tracks": list(tracks)})


def test_requires_a_token(client):
    assert client.get(f"/tracks/{SOURCE}/compatible").status_code == 401


def test_ranks_the_library_best_first(authed_client):
    fake = _fake(
        _track(SOURCE, "Source", 128.0, "8A"),
        _track(uid(1), "Same key same tempo", 128.0, "8A"),
        _track(uid(2), "Clashing", 128.0, "2B"),
        _track(uid(3), "Neighbour", 129.0, "9A"),
    )

    body = authed_client(fake).get(f"/tracks/{SOURCE}/compatible").json()

    scores = [item["score"] for item in body]
    assert scores == sorted(scores, reverse=True)
    assert body[0]["track"]["title"] == "Same key same tempo"
    assert body[0]["score"] == 100
    assert body[-1]["track"]["title"] == "Clashing"


def test_excludes_the_source_track(authed_client):
    fake = _fake(_track(SOURCE, "Source"), _track(uid(1), "Other"))

    body = authed_client(fake).get(f"/tracks/{SOURCE}/compatible").json()

    assert [item["track"]["id"] for item in body] == [uid(1)]


def test_skips_unanalysed_tracks_rather_than_ranking_them_last(authed_client):
    # A zero would read as "bad match" when the truth is "not known yet".
    fake = _fake(
        _track(SOURCE, "Source"),
        _track(uid(1), "Analysed"),
        _track(uid(2), "Pending", status="pending"),
        _track(uid(3), "Failed", status="failed"),
    )

    body = authed_client(fake).get(f"/tracks/{SOURCE}/compatible").json()

    assert [item["track"]["title"] for item in body] == ["Analysed"]


def test_explains_each_match(authed_client):
    fake = _fake(_track(SOURCE, "Source", 128.0, "8A"), _track(uid(1), "Relative", 128.0, "8B"))

    item = authed_client(fake).get(f"/tracks/{SOURCE}/compatible").json()[0]

    assert item["harmonic"]["relation"] == "relative"
    assert item["tempo"]["delta_percent"] == 0
    assert item["notes"]


def test_respects_the_limit(authed_client):
    fake = _fake(_track(SOURCE, "Source"), *[_track(uid(100 + i), f"Track {i}") for i in range(10)])

    body = authed_client(fake).get(f"/tracks/{SOURCE}/compatible", params={"limit": 3}).json()

    assert len(body) == 3


def test_rejects_an_absurd_limit(authed_client):
    fake = _fake(_track(SOURCE, "Source"))
    assert (
        authed_client(fake).get(f"/tracks/{SOURCE}/compatible", params={"limit": 5000}).status_code
        == 422
    )


def test_unknown_track_is_404(authed_client):
    fake = _fake(_track(uid(9), "Not the one"))
    assert authed_client(fake).get(f"/tracks/{SOURCE}/compatible").status_code == 404


def test_an_unanalysed_source_is_409_not_an_empty_list(authed_client):
    # An empty list would suggest "nothing matches"; the truth is "cannot match yet".
    fake = _fake(_track(SOURCE, "Source", status="pending"), _track(uid(1), "Other"))

    response = authed_client(fake).get(f"/tracks/{SOURCE}/compatible")

    assert response.status_code == 409
    assert "analysis" in response.json()["detail"].lower()


def test_a_library_of_one_returns_nothing(authed_client):
    fake = _fake(_track(SOURCE, "Source"))
    response = authed_client(fake).get(f"/tracks/{SOURCE}/compatible")

    assert response.status_code == 200
    assert response.json() == []
