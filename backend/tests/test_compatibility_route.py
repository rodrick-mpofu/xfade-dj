from tests.fakes import FakeSupabase

TRACK_A = "22222222-2222-4222-8222-222222222222"
TRACK_B = "33333333-3333-4333-8333-333333333333"


def _row(track_id, **feature_overrides):
    features = {
        "track_id": track_id,
        "status": "complete",
        "bpm": 128.0,
        "key_camelot": "8A",
        **feature_overrides,
    }
    return {"id": track_id, "audio_features": features}


def _both(**overrides):
    return FakeSupabase(rows={"tracks": [_row(TRACK_A), _row(TRACK_B, **overrides)]})


def test_requires_a_token(client):
    response = client.get("/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_B})
    assert response.status_code == 401


def test_scores_a_complete_pair(authed_client):
    response = authed_client(_both()).get(
        "/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_B}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["score"] == 100
    assert body["harmonic"]["relation"] == "identical"
    assert body["tempo"]["double_time"] is False
    assert body["notes"]


def test_pending_extraction_is_not_an_error(authed_client):
    # The combo logger shows progress rather than a failure while analysis runs.
    fake = _both(status="pending", bpm=None, key_camelot=None)

    response = authed_client(fake).get(
        "/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_B}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending_extraction"
    assert body["score"] is None


def test_failed_extraction_is_distinct_from_pending(authed_client):
    # Pending resolves on its own; failed never will. The UI needs to tell them
    # apart or it polls forever on a track that will never produce features.
    fake = _both(status="failed", bpm=None, key_camelot=None)

    body = (
        authed_client(fake)
        .get("/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_B})
        .json()
    )

    assert body["status"] == "extraction_failed"
    assert body["score"] is None


def test_missing_feature_row_is_reported(authed_client):
    fake = FakeSupabase(rows={"tracks": [_row(TRACK_A), {"id": TRACK_B, "audio_features": None}]})

    body = (
        authed_client(fake)
        .get("/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_B})
        .json()
    )

    assert body["status"] == "missing_features"


def test_complete_but_null_values_do_not_crash(authed_client):
    # Should be impossible given the audio_features_complete_has_values constraint,
    # but the endpoint must not 500 if it ever happens.
    fake = _both(status="complete", bpm=None, key_camelot=None)

    response = authed_client(fake).get(
        "/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_B}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "missing_features"


def test_unknown_track_is_404(authed_client):
    fake = FakeSupabase(rows={"tracks": [_row(TRACK_A)]})

    response = authed_client(fake).get(
        "/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_B}
    )

    assert response.status_code == 404
    assert TRACK_B in response.json()["detail"]


def test_a_track_cannot_be_scored_against_itself(authed_client):
    response = authed_client(_both()).get(
        "/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_A}
    )

    assert response.status_code == 400


def test_malformed_id_is_422(authed_client):
    response = authed_client(_both()).get(
        "/compatibility", params={"track_a": "not-a-uuid", "track_b": TRACK_B}
    )

    assert response.status_code == 422


def test_both_tracks_are_fetched_in_one_query(authed_client):
    fake = _both()

    authed_client(fake).get("/compatibility", params={"track_a": TRACK_A, "track_b": TRACK_B})

    # The session planner scores every adjacent pair; a query per track would make
    # that N round trips instead of N.
    filters = fake.calls_named("in_")
    assert len(filters) == 1
    assert set(filters[0][2]) == {TRACK_A, TRACK_B}
