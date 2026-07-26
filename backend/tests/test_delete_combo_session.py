"""Combo and session deletion — backlog §5."""

from tests.conftest import TEST_USER_ID
from tests.fakes import FakeSupabase

COMBO_ID = "44444444-4444-4444-8444-444444444444"
SESSION_ID = "66666666-6666-4666-8666-666666666666"


def _combo():
    return {
        "id": COMBO_ID,
        "user_id": TEST_USER_ID,
        "track_a_id": "22222222-2222-4222-8222-222222222222",
        "track_b_id": "33333333-3333-4333-8333-333333333333",
        "technique": "bass swap",
        "rating": 4,
        "logged_at": "2026-07-25T12:00:00Z",
    }


def _session():
    return {
        "id": SESSION_ID,
        "user_id": TEST_USER_ID,
        "name": "Friday warm-up",
        "planned_for": None,
        "created_at": "2026-07-25T12:00:00Z",
        "session_tracks": [],
    }


# --- combos -----------------------------------------------------------------


def test_deleting_a_combo_requires_a_token(client):
    assert client.delete(f"/combos/{COMBO_ID}").status_code == 401


def test_delete_a_combo(authed_client):
    fake = FakeSupabase(rows={"combos": [_combo()]})

    response = authed_client(fake).delete(f"/combos/{COMBO_ID}")

    assert response.status_code == 204
    assert ("combos",) in fake.calls_named("delete")


def test_deleting_an_unknown_combo_is_404(authed_client):
    fake = FakeSupabase(rows={"combos": []})

    response = authed_client(fake).delete(f"/combos/{COMBO_ID}")

    assert response.status_code == 404
    assert fake.calls_named("delete") == []


def test_a_malformed_combo_id_is_422(authed_client):
    assert authed_client(FakeSupabase()).delete("/combos/not-a-uuid").status_code == 422


# --- sessions ---------------------------------------------------------------


def test_deleting_a_session_requires_a_token(client):
    assert client.delete(f"/sessions/{SESSION_ID}").status_code == 401


def test_delete_a_session(authed_client):
    fake = FakeSupabase(rows={"sessions": [_session()]})

    response = authed_client(fake).delete(f"/sessions/{SESSION_ID}")

    assert response.status_code == 204
    assert ("sessions",) in fake.calls_named("delete")


def test_deleting_a_session_does_not_touch_tracks(authed_client):
    # Discarding a setlist must not discard the music in it.
    fake = FakeSupabase(rows={"sessions": [_session()]})

    authed_client(fake).delete(f"/sessions/{SESSION_ID}")

    deleted_tables = [table for (table,) in fake.calls_named("delete")]
    assert deleted_tables == ["sessions"]


def test_deleting_an_unknown_session_is_404(authed_client):
    fake = FakeSupabase(rows={"sessions": []})

    response = authed_client(fake).delete(f"/sessions/{SESSION_ID}")

    assert response.status_code == 404
    assert fake.calls_named("delete") == []
