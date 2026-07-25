import uuid

from tests.conftest import TEST_USER_ID
from tests.fakes import FakeSupabase

TRACK_ID = "22222222-2222-4222-8222-222222222222"


def _track_row(**overrides):
    row = {
        "id": TRACK_ID,
        "user_id": TEST_USER_ID,
        "title": "Windowlicker",
        "artist": "Aphex Twin",
        "file_ref": f"{TEST_USER_ID}/{TRACK_ID}.mp3",
        "source": "upload",
        "created_at": "2026-07-25T12:00:00Z",
    }
    return {**row, **overrides}


def _features_row(**overrides):
    return {"track_id": TRACK_ID, "status": "pending", **overrides}


# --- auth ------------------------------------------------------------------


def test_list_tracks_requires_a_token(client):
    assert client.get("/tracks").status_code == 401


def test_upload_requires_a_token(client):
    response = client.post(
        "/tracks",
        files={"file": ("a.mp3", b"data", "audio/mpeg")},
        data={"title": "A"},
    )
    assert response.status_code == 401


# --- upload ----------------------------------------------------------------


def test_upload_stores_object_and_creates_pending_features(authed_client):
    fake = FakeSupabase(rows={"tracks": [_track_row()], "audio_features": [_features_row()]})

    response = authed_client(fake).post(
        "/tracks",
        files={"file": ("windowlicker.MP3", b"fake audio bytes", "audio/mpeg")},
        data={"title": "Windowlicker", "artist": "Aphex Twin"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["audio_features"]["status"] == "pending"

    # Object key must stay "<user_id>/<track_id>.<ext>" — the storage policies
    # authorize on that first segment.
    ((path, size, options),) = fake.calls_named("upload")
    user_segment, filename = path.split("/")
    assert user_segment == TEST_USER_ID
    stem, extension = filename.rsplit(".", 1)
    uuid.UUID(stem)
    assert extension == "mp3"  # uppercase input extension normalised
    assert size == len(b"fake audio bytes")
    assert options["content-type"] == "audio/mpeg"

    inserted = dict(fake.calls_named("insert"))
    assert inserted["audio_features"]["status"] == "pending"
    assert inserted["tracks"]["file_ref"] == path
    assert inserted["tracks"]["user_id"] == TEST_USER_ID


def test_upload_rejects_unsupported_extension(authed_client):
    fake = FakeSupabase()

    response = authed_client(fake).post(
        "/tracks",
        files={"file": ("mix.txt", b"not audio", "audio/mpeg")},
        data={"title": "Not audio"},
    )

    assert response.status_code == 415
    # Nothing should have been written anywhere.
    assert fake.calls_named("upload") == []
    assert fake.calls_named("insert") == []


def test_upload_rejects_empty_file(authed_client):
    fake = FakeSupabase()

    response = authed_client(fake).post(
        "/tracks",
        files={"file": ("empty.wav", b"", "audio/wav")},
        data={"title": "Empty"},
    )

    assert response.status_code == 400
    assert fake.calls_named("upload") == []


def test_upload_requires_a_title(authed_client):
    fake = FakeSupabase()

    response = authed_client(fake).post(
        "/tracks",
        files={"file": ("a.mp3", b"data", "audio/mpeg")},
    )

    assert response.status_code == 422


def test_failed_insert_removes_the_orphaned_object(authed_client):
    fake = FakeSupabase(fail_insert=True)

    response = authed_client(fake).post(
        "/tracks",
        files={"file": ("a.mp3", b"data", "audio/mpeg")},
        data={"title": "A"},
    )

    assert response.status_code == 500
    uploaded = fake.calls_named("upload")[0][0]
    assert fake.calls_named("remove") == [(uploaded,)]


def test_storage_failure_is_reported_as_502(authed_client):
    fake = FakeSupabase(fail_upload=True)

    response = authed_client(fake).post(
        "/tracks",
        files={"file": ("a.mp3", b"data", "audio/mpeg")},
        data={"title": "A"},
    )

    assert response.status_code == 502
    assert fake.calls_named("insert") == []


# --- read ------------------------------------------------------------------


def test_list_tracks_returns_embedded_features(authed_client):
    # PostgREST may embed a to-one relation as a single-element list.
    fake = FakeSupabase(
        rows={"tracks": [{**_track_row(), "audio_features": [_features_row(status="complete")]}]}
    )

    response = authed_client(fake).get("/tracks")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["audio_features"]["status"] == "complete"


def test_list_tracks_paginates(authed_client):
    fake = FakeSupabase(rows={"tracks": []})

    response = authed_client(fake).get("/tracks", params={"limit": 10, "offset": 20})

    assert response.status_code == 200
    assert ("tracks", 20, 29) in fake.calls_named("range")


def test_list_tracks_rejects_an_oversized_limit(authed_client):
    response = authed_client(FakeSupabase()).get("/tracks", params={"limit": 5000})

    assert response.status_code == 422


def test_track_detail_without_features_reports_null(authed_client):
    fake = FakeSupabase(rows={"tracks": [{**_track_row(), "audio_features": None}]})

    response = authed_client(fake).get(f"/tracks/{TRACK_ID}")

    assert response.status_code == 200
    assert response.json()["audio_features"] is None


def test_missing_track_is_404(authed_client):
    fake = FakeSupabase(rows={"tracks": []})

    response = authed_client(fake).get(f"/tracks/{TRACK_ID}")

    assert response.status_code == 404


def test_malformed_track_id_is_422(authed_client):
    response = authed_client(FakeSupabase()).get("/tracks/not-a-uuid")

    assert response.status_code == 422
