from tests.conftest import TEST_USER_ID
from tests.fakes import FakeSupabase

TRACK_A = "22222222-2222-4222-8222-222222222222"
TRACK_B = "33333333-3333-4333-8333-333333333333"
COMBO_ID = "44444444-4444-4444-8444-444444444444"


def _combo_row(**overrides):
    return {
        "id": COMBO_ID,
        "user_id": TEST_USER_ID,
        "track_a_id": TRACK_A,
        "track_b_id": TRACK_B,
        "technique": "bass swap",
        "rating": 4,
        "logged_at": "2026-07-25T12:00:00Z",
        **overrides,
    }


def _note_row(text="held it 32 bars"):
    return {
        "id": "55555555-5555-4555-8555-555555555555",
        "combo_id": COMBO_ID,
        "text": text,
        "created_at": "2026-07-25T12:00:00Z",
    }


def _fake(**rows):
    base = {
        "tracks": [{"id": TRACK_A}, {"id": TRACK_B}],
        "combos": [_combo_row()],
        "combo_notes": [_note_row()],
    }
    return FakeSupabase(rows={**base, **rows})


def test_logging_requires_a_token(client):
    response = client.post("/combos", json={"track_a_id": TRACK_A, "track_b_id": TRACK_B})
    assert response.status_code == 401


def test_log_a_combo(authed_client):
    fake = _fake()

    response = authed_client(fake).post(
        "/combos",
        json={
            "track_a_id": TRACK_A,
            "track_b_id": TRACK_B,
            "technique": "bass swap",
            "rating": 4,
            "notes": ["held it 32 bars"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["technique"] == "bass swap"
    assert [n["text"] for n in body["notes"]] == ["held it 32 bars"]

    inserted = dict(fake.calls_named("insert"))
    assert inserted["combos"]["user_id"] == TEST_USER_ID
    # Notes go in with the combo — logging friction is the thing to minimise.
    assert len(inserted["combo_notes"]) == 1


def test_a_combo_without_notes_is_fine(authed_client):
    fake = _fake(combo_notes=[])

    response = authed_client(fake).post(
        "/combos", json={"track_a_id": TRACK_A, "track_b_id": TRACK_B}
    )

    assert response.status_code == 201
    assert response.json()["notes"] == []
    assert "combo_notes" not in dict(fake.calls_named("insert"))


def test_blank_notes_are_dropped(authed_client):
    fake = _fake(combo_notes=[])

    authed_client(fake).post(
        "/combos",
        json={"track_a_id": TRACK_A, "track_b_id": TRACK_B, "notes": ["  ", ""]},
    )

    assert "combo_notes" not in dict(fake.calls_named("insert"))


def test_unknown_track_is_404(authed_client):
    fake = _fake(tracks=[{"id": TRACK_A}])

    response = authed_client(fake).post(
        "/combos", json={"track_a_id": TRACK_A, "track_b_id": TRACK_B}
    )

    assert response.status_code == 404
    assert TRACK_B in response.json()["detail"]
    assert fake.calls_named("insert") == []


def test_a_track_cannot_be_combined_with_itself(authed_client):
    response = authed_client(_fake()).post(
        "/combos", json={"track_a_id": TRACK_A, "track_b_id": TRACK_A}
    )
    assert response.status_code == 422


def test_rating_is_bounded(authed_client):
    for rating in (0, 6, -1):
        response = authed_client(_fake()).post(
            "/combos",
            json={"track_a_id": TRACK_A, "track_b_id": TRACK_B, "rating": rating},
        )
        assert response.status_code == 422


def test_list_combos_embeds_notes(authed_client):
    fake = _fake(combos=[{**_combo_row(), "combo_notes": [_note_row()]}])

    body = authed_client(fake).get("/combos").json()

    assert len(body) == 1
    assert body[0]["notes"][0]["text"] == "held it 32 bars"


def test_filtering_by_track_matches_either_side(authed_client):
    # Combos are directional, so a track can be either A or B in one.
    fake = _fake(combos=[{**_combo_row(), "combo_notes": []}])

    authed_client(fake).get("/combos", params={"track_id": TRACK_B})

    expression = fake.calls_named("or_")[0][1]
    assert f"track_a_id.eq.{TRACK_B}" in expression
    assert f"track_b_id.eq.{TRACK_B}" in expression


def test_unfiltered_listing_does_not_add_a_track_filter(authed_client):
    fake = _fake(combos=[])

    authed_client(fake).get("/combos")

    assert fake.calls_named("or_") == []


def test_listing_paginates(authed_client):
    fake = _fake(combos=[])

    authed_client(fake).get("/combos", params={"limit": 10, "offset": 30})

    assert ("combos", 30, 39) in fake.calls_named("range")
