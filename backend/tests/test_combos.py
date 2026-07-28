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


# --- editing -----------------------------------------------------------------
#
# Backlog §5: a wrong rating or technique used to mean deleting and re-logging.
# The tracks stay immutable — changing either side is a different transition, not
# a correction.


def test_editing_requires_a_token(client):
    assert client.patch(f"/combos/{COMBO_ID}", json={"rating": 5}).status_code == 401


def test_update_writes_only_the_fields_sent(authed_client):
    fake = _fake()

    response = authed_client(fake).patch(f"/combos/{COMBO_ID}", json={"rating": 5})

    assert response.status_code == 200
    payload = fake.calls_named("update")[0][1]
    assert payload == {"rating": 5}
    # Omitting technique must leave it alone rather than blanking it.
    assert "technique" not in payload


def test_an_explicit_null_clears_a_field(authed_client):
    # Distinct from omitting it: "no rating" and "no opinion" are different edits.
    fake = _fake()

    authed_client(fake).patch(f"/combos/{COMBO_ID}", json={"rating": None})

    assert fake.calls_named("update")[0][1] == {"rating": None}


def test_a_blank_technique_becomes_null(authed_client):
    # A cleared text field posts "", which should not sit in the column as an
    # empty string masquerading as a technique.
    fake = _fake()

    authed_client(fake).patch(f"/combos/{COMBO_ID}", json={"technique": "   "})

    assert fake.calls_named("update")[0][1] == {"technique": None}


def test_an_empty_patch_is_rejected(authed_client):
    response = authed_client(_fake()).patch(f"/combos/{COMBO_ID}", json={})

    assert response.status_code == 400
    assert "No fields" in response.json()["detail"]


def test_updating_a_missing_combo_is_404(authed_client):
    response = authed_client(_fake(combos=[])).patch(f"/combos/{COMBO_ID}", json={"rating": 5})

    assert response.status_code == 404


def test_the_tracks_cannot_be_edited(authed_client):
    # Not in ComboUpdate at all, so pydantic drops it rather than writing it.
    fake = _fake()

    authed_client(fake).patch(f"/combos/{COMBO_ID}", json={"track_a_id": TRACK_B, "rating": 3})

    assert fake.calls_named("update")[0][1] == {"rating": 3}


def test_rating_bounds_are_enforced(authed_client):
    for bad in (0, 6, 99):
        response = authed_client(_fake()).patch(f"/combos/{COMBO_ID}", json={"rating": bad})
        assert response.status_code == 422, bad


def test_the_response_carries_the_notes_back(authed_client):
    fake = _fake(combos=[{**_combo_row(), "combo_notes": [_note_row()]}])

    response = authed_client(fake).patch(f"/combos/{COMBO_ID}", json={"rating": 5})

    assert response.json()["notes"][0]["text"] == "held it 32 bars"
