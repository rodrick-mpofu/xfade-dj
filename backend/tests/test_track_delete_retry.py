"""Deletion and extraction retry — backlog §5."""

import pytest

from tests.conftest import TEST_USER_ID
from tests.fakes import FakeSupabase

TRACK_ID = "22222222-2222-4222-8222-222222222222"
FILE_REF = f"{TEST_USER_ID}/{TRACK_ID}.mp3"


def _track(status="complete", file_ref=FILE_REF, **feature_overrides):
    features = {
        "track_id": TRACK_ID,
        "status": status,
        "bpm": 128.0,
        "key_camelot": "8A",
        "energy": 0.4,
        "danceability": 0.5,
        "structure_markers": {"beat_count": 200},
        "error_message": None,
        "analyzed_at": "2026-07-25T12:00:00Z",
        **feature_overrides,
    }
    return {
        "id": TRACK_ID,
        "user_id": TEST_USER_ID,
        "title": "Windowlicker",
        "artist": "Aphex Twin",
        "file_ref": file_ref,
        "source": "upload",
        "created_at": "2026-07-25T12:00:00Z",
        "audio_features": features,
    }


@pytest.fixture(autouse=True)
def queued(monkeypatch):
    """Stop the background task from doing real work (and real network IO)."""
    calls: list = []
    monkeypatch.setattr(
        "app.api.routes.tracks.schedule_extraction",
        lambda background_tasks, track_id: calls.append(track_id),
    )
    return calls


# --- delete -----------------------------------------------------------------


def test_delete_requires_a_token(client):
    assert client.delete(f"/tracks/{TRACK_ID}").status_code == 401


def test_delete_removes_the_row_and_the_audio_file(authed_client):
    fake = FakeSupabase(rows={"tracks": [_track()]})

    response = authed_client(fake).delete(f"/tracks/{TRACK_ID}")

    assert response.status_code == 204
    assert ("tracks",) in fake.calls_named("delete")
    assert fake.calls_named("remove") == [(FILE_REF,)]


def test_delete_removes_the_row_before_the_object(authed_client):
    # The reverse order can leave a row pointing at audio that no longer exists,
    # which reads as a playable track that cannot be re-analysed.
    fake = FakeSupabase(rows={"tracks": [_track()]})

    authed_client(fake).delete(f"/tracks/{TRACK_ID}")

    names = [name for name, _ in fake.calls]
    assert names.index("delete") < names.index("remove")


def test_delete_succeeds_even_if_storage_cleanup_fails(authed_client):
    # An orphaned object is a smaller problem than a failed delete the user retries.
    fake = FakeSupabase(rows={"tracks": [_track()]})
    fake.storage._fail_remove = True

    assert authed_client(fake).delete(f"/tracks/{TRACK_ID}").status_code == 204
    assert ("tracks",) in fake.calls_named("delete")


def test_deleting_a_track_with_no_file_skips_storage(authed_client):
    fake = FakeSupabase(rows={"tracks": [_track(file_ref=None)]})

    assert authed_client(fake).delete(f"/tracks/{TRACK_ID}").status_code == 204
    assert fake.calls_named("remove") == []


def test_deleting_an_unknown_track_is_404(authed_client):
    fake = FakeSupabase(rows={"tracks": []})

    response = authed_client(fake).delete(f"/tracks/{TRACK_ID}")

    assert response.status_code == 404
    assert fake.calls_named("delete") == []
    assert fake.calls_named("remove") == []


# --- retry ------------------------------------------------------------------


def test_retry_requires_a_token(client):
    assert client.post(f"/tracks/{TRACK_ID}/extract").status_code == 401


def test_retry_resets_the_row_and_requeues(authed_client, queued):
    fake = FakeSupabase(rows={"tracks": [_track(status="failed", error_message="boom")]})

    response = authed_client(fake).post(f"/tracks/{TRACK_ID}/extract")

    assert response.status_code == 202
    assert response.json()["audio_features"]["status"] == "pending"
    assert len(queued) == 1

    written = dict(fake.calls_named("upsert"))["audio_features"]
    assert written["status"] == "pending"
    assert written["error_message"] is None


def test_retry_clears_stale_feature_values(authed_client):
    # Leaving the old BPM behind would show a "pending" track with confident
    # numbers from the previous run.
    fake = FakeSupabase(rows={"tracks": [_track(status="complete")]})

    authed_client(fake).post(f"/tracks/{TRACK_ID}/extract")

    written = dict(fake.calls_named("upsert"))["audio_features"]
    assert written["bpm"] is None
    assert written["key_camelot"] is None
    assert written["structure_markers"] is None
    assert written["analyzed_at"] is None


def test_retry_works_on_an_already_complete_track(authed_client, queued):
    # Re-analysing is how a track picks up an improved pipeline.
    fake = FakeSupabase(rows={"tracks": [_track(status="complete")]})

    assert authed_client(fake).post(f"/tracks/{TRACK_ID}/extract").status_code == 202
    assert len(queued) == 1


def test_retry_refuses_while_a_job_is_running(authed_client, queued):
    fake = FakeSupabase(rows={"tracks": [_track(status="processing")]})

    response = authed_client(fake).post(f"/tracks/{TRACK_ID}/extract")

    assert response.status_code == 409
    assert queued == []
    assert fake.calls_named("upsert") == []


def test_retry_refuses_a_track_with_no_audio(authed_client, queued):
    fake = FakeSupabase(rows={"tracks": [_track(file_ref=None)]})

    response = authed_client(fake).post(f"/tracks/{TRACK_ID}/extract")

    assert response.status_code == 409
    assert queued == []


def test_retry_on_an_unknown_track_is_404(authed_client, queued):
    fake = FakeSupabase(rows={"tracks": []})

    assert authed_client(fake).post(f"/tracks/{TRACK_ID}/extract").status_code == 404
    assert queued == []


def test_retry_creates_a_features_row_if_one_is_missing(authed_client):
    # upsert rather than update: a track whose features row never existed still
    # needs one, or the reset would silently affect nothing.
    fake = FakeSupabase(rows={"tracks": [{**_track(), "audio_features": None}]})

    response = authed_client(fake).post(f"/tracks/{TRACK_ID}/extract")

    assert response.status_code == 202
    assert fake.calls_named("upsert")
