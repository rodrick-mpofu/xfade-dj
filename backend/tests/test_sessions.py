from tests.conftest import TEST_USER_ID
from tests.fakes import FakeSupabase

SESSION_ID = "66666666-6666-4666-8666-666666666666"
TRACK_A = "22222222-2222-4222-8222-222222222222"
TRACK_B = "33333333-3333-4333-8333-333333333333"


def _session_row(tracks=None, **overrides):
    return {
        "id": SESSION_ID,
        "user_id": TEST_USER_ID,
        "name": "Friday warm-up",
        "planned_for": "2026-08-01T21:00:00Z",
        "created_at": "2026-07-25T12:00:00Z",
        "session_tracks": tracks if tracks is not None else [],
        **overrides,
    }


def _entry(track_id, position, entry_id=None):
    return {
        "id": entry_id or f"{position}7777777-7777-4777-8777-777777777777"[:36],
        "session_id": SESSION_ID,
        "track_id": track_id,
        "position": position,
    }


def _fake(**rows):
    base = {
        "sessions": [_session_row()],
        "tracks": [{"id": TRACK_A}, {"id": TRACK_B}],
        "session_tracks": [_entry(TRACK_A, 0)],
    }
    return FakeSupabase(rows={**base, **rows})


def test_creating_requires_a_token(client):
    assert client.post("/sessions", json={"name": "x"}).status_code == 401


def test_create_a_session(authed_client):
    fake = _fake()

    response = authed_client(fake).post(
        "/sessions", json={"name": "Friday warm-up", "planned_for": "2026-08-01T21:00:00Z"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Friday warm-up"
    assert body["tracks"] == []
    assert dict(fake.calls_named("insert"))["sessions"]["user_id"] == TEST_USER_ID


def test_a_session_needs_a_name(authed_client):
    assert authed_client(_fake()).post("/sessions", json={"name": "  "}).status_code == 422


def test_planned_for_is_optional(authed_client):
    assert authed_client(_fake()).post("/sessions", json={"name": "Untitled"}).status_code == 201


def test_detail_returns_tracks_in_play_order(authed_client):
    # PostgREST does not promise embed ordering; the setlist order is the point.
    scrambled = [_entry(TRACK_B, 2), _entry(TRACK_A, 0), _entry(TRACK_B, 1)]
    fake = _fake(sessions=[_session_row(tracks=scrambled)])

    body = authed_client(fake).get(f"/sessions/{SESSION_ID}").json()

    assert [t["position"] for t in body["tracks"]] == [0, 1, 2]


def test_unknown_session_is_404(authed_client):
    fake = _fake(sessions=[])
    assert authed_client(fake).get(f"/sessions/{SESSION_ID}").status_code == 404


def test_append_puts_a_track_at_the_end(authed_client):
    existing = [_entry(TRACK_A, 0), _entry(TRACK_B, 1)]
    fake = _fake(
        sessions=[_session_row(tracks=existing)],
        session_tracks=[_entry(TRACK_A, 2)],
    )

    response = authed_client(fake).post(
        f"/sessions/{SESSION_ID}/tracks", json={"track_id": TRACK_A}
    )

    assert response.status_code == 201
    assert dict(fake.calls_named("insert"))["session_tracks"]["position"] == 2


def test_append_to_an_empty_session_starts_at_zero(authed_client):
    fake = _fake(session_tracks=[_entry(TRACK_A, 0)])

    authed_client(fake).post(f"/sessions/{SESSION_ID}/tracks", json={"track_id": TRACK_A})

    assert dict(fake.calls_named("insert"))["session_tracks"]["position"] == 0


def test_appending_an_unknown_track_is_404(authed_client):
    fake = _fake(tracks=[])

    response = authed_client(fake).post(
        f"/sessions/{SESSION_ID}/tracks", json={"track_id": TRACK_A}
    )

    assert response.status_code == 404
    assert fake.calls_named("insert") == []


def test_replace_uses_the_atomic_function(authed_client):
    # Not a delete-then-insert: a failure between the two would strand the setlist
    # empty, losing work the user curated by hand.
    fake = _fake(set_session_tracks=[_entry(TRACK_B, 0), _entry(TRACK_A, 1)])

    response = authed_client(fake).put(
        f"/sessions/{SESSION_ID}/tracks", json={"track_ids": [TRACK_B, TRACK_A]}
    )

    assert response.status_code == 200
    assert [t["track_id"] for t in response.json()] == [TRACK_B, TRACK_A]

    ((function, params),) = fake.calls_named("rpc")
    assert function == "set_session_tracks"
    assert params["p_track_ids"] == [TRACK_B, TRACK_A]
    assert fake.calls_named("delete") == []


def test_replace_returns_tracks_in_position_order(authed_client):
    fake = _fake(set_session_tracks=[_entry(TRACK_A, 1), _entry(TRACK_B, 0)])

    body = (
        authed_client(fake)
        .put(f"/sessions/{SESSION_ID}/tracks", json={"track_ids": [TRACK_B, TRACK_A]})
        .json()
    )

    assert [t["position"] for t in body] == [0, 1]


def test_an_empty_list_clears_the_setlist(authed_client):
    fake = _fake(set_session_tracks=[])

    response = authed_client(fake).put(f"/sessions/{SESSION_ID}/tracks", json={"track_ids": []})

    assert response.status_code == 200
    assert response.json() == []
    assert fake.calls_named("rpc")[0][1]["p_track_ids"] == []


def test_replacing_with_an_unknown_track_is_404(authed_client):
    fake = _fake(tracks=[{"id": TRACK_A}])

    response = authed_client(fake).put(
        f"/sessions/{SESSION_ID}/tracks", json={"track_ids": [TRACK_A, TRACK_B]}
    )

    assert response.status_code == 404
    assert fake.calls_named("rpc") == []


def test_replacing_on_an_unknown_session_is_404(authed_client):
    fake = _fake(sessions=[])

    response = authed_client(fake).put(
        f"/sessions/{SESSION_ID}/tracks", json={"track_ids": [TRACK_A]}
    )

    assert response.status_code == 404
    assert fake.calls_named("rpc") == []


def test_a_failing_replace_is_reported(authed_client):
    fake = FakeSupabase(
        rows={"sessions": [_session_row()], "tracks": [{"id": TRACK_A}]}, fail_rpc=True
    )

    response = authed_client(fake).put(
        f"/sessions/{SESSION_ID}/tracks", json={"track_ids": [TRACK_A]}
    )

    assert response.status_code == 400


def test_the_same_track_may_appear_twice(authed_client):
    # A reprise is a legitimate setlist move; the surrogate PK allows it.
    fake = _fake(set_session_tracks=[_entry(TRACK_A, 0), _entry(TRACK_A, 1)])

    response = authed_client(fake).put(
        f"/sessions/{SESSION_ID}/tracks", json={"track_ids": [TRACK_A, TRACK_A]}
    )

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_listing_paginates(authed_client):
    fake = _fake(sessions=[])

    authed_client(fake).get("/sessions", params={"limit": 5, "offset": 10})

    assert ("sessions", 10, 14) in fake.calls_named("range")
