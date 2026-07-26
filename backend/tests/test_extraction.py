"""Extraction orchestration.

Essentia is never imported here — ``analyze_file`` is replaced — so these run on a
Windows host. What they cover is the state machine and cleanup, which is where the
job can leave a track wedged. The DSP itself needs the container and a real file.
"""

import os
from uuid import UUID

import pytest

from app.core.tags import TagFeatures
from app.services import extraction
from app.services.audio_analysis import AnalysisResult
from tests.fakes import FakeSupabase

TRACK_ID = UUID("22222222-2222-4222-8222-222222222222")


def _tags(**overrides) -> TagFeatures:
    return TagFeatures(**{"bpm": None, "key_camelot": None, "genre": None, **overrides})


def _result(**overrides) -> AnalysisResult:
    fields = {
        "bpm": 128.0,
        "key_camelot": "8A",
        "energy": 0.42,
        "danceability": 0.61,
        "duration_seconds": 212.5,
        "structure_markers": {"beat_count": 256},
    }
    return AnalysisResult(**{**fields, **overrides})


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase(rows={"tracks": [{"file_ref": "user-id/track-id.mp3"}]})
    monkeypatch.setattr(extraction, "get_service_client", lambda: fake)
    return fake


def _updates(fake, table="audio_features"):
    return [payload for name, payload in fake.calls_named("update") if name == table]


def test_successful_extraction_writes_complete_features(fake_db, monkeypatch):
    monkeypatch.setattr("app.services.audio_analysis.analyze_file", lambda path: _result())

    extraction.run_extraction(TRACK_ID)

    updates = _updates(fake_db)
    assert updates[0]["status"] == "processing"

    final = updates[-1]
    assert final["status"] == "complete"
    assert final["bpm"] == 128.0
    assert final["key_camelot"] == "8A"
    assert final["error_message"] is None
    assert final["analyzed_at"]


def test_downloaded_file_is_removed_afterwards(fake_db, monkeypatch):
    seen: list[str] = []

    def _capture(path):
        seen.append(path)
        assert os.path.exists(path)
        return _result()

    monkeypatch.setattr("app.services.audio_analysis.analyze_file", _capture)

    extraction.run_extraction(TRACK_ID)

    # Audio files are large; a leaked temp dir per upload fills the disk quietly.
    assert seen and not os.path.exists(seen[0])


def test_temp_file_keeps_the_original_extension(fake_db, monkeypatch):
    # Essentia picks its decoder from the suffix, so this is load-bearing.
    seen: list[str] = []
    monkeypatch.setattr(
        "app.services.audio_analysis.analyze_file",
        lambda path: (seen.append(path), _result())[1],
    )

    extraction.run_extraction(TRACK_ID)

    assert seen[0].endswith(".mp3")


def test_analysis_failure_is_recorded_not_raised(fake_db, monkeypatch):
    def _boom(path):
        raise RuntimeError("could not decode")

    monkeypatch.setattr("app.services.audio_analysis.analyze_file", _boom)

    extraction.run_extraction(TRACK_ID)  # must not raise

    final = _updates(fake_db)[-1]
    assert final["status"] == "failed"
    assert "could not decode" in final["error_message"]


def test_unmappable_key_fails_rather_than_writing_complete(fake_db, monkeypatch):
    # audio_features_complete_has_values would reject a 'complete' row with a null
    # key; catching it here keeps the row out of a stuck 'processing' state.
    monkeypatch.setattr(
        "app.services.audio_analysis.analyze_file",
        lambda path: _result(key_camelot=None),
    )

    extraction.run_extraction(TRACK_ID)

    final = _updates(fake_db)[-1]
    assert final["status"] == "failed"
    assert "Camelot" in final["error_message"]


def test_missing_track_row_is_recorded_as_failed(monkeypatch):
    fake = FakeSupabase(rows={"tracks": []})
    monkeypatch.setattr(extraction, "get_service_client", lambda: fake)

    extraction.run_extraction(TRACK_ID)

    assert _updates(fake)[-1]["status"] == "failed"


def test_track_without_a_file_is_recorded_as_failed(monkeypatch):
    fake = FakeSupabase(rows={"tracks": [{"file_ref": None}]})
    monkeypatch.setattr(extraction, "get_service_client", lambda: fake)

    extraction.run_extraction(TRACK_ID)

    final = _updates(fake)[-1]
    assert final["status"] == "failed"
    # Nothing should have been downloaded.
    assert fake.calls_named("download") == []


def test_error_message_is_truncated(fake_db, monkeypatch):
    def _boom(path):
        raise RuntimeError("x" * 2000)

    monkeypatch.setattr("app.services.audio_analysis.analyze_file", _boom)

    extraction.run_extraction(TRACK_ID)

    assert len(_updates(fake_db)[-1]["error_message"]) <= 500


def _genre_updates(fake):
    return [payload for name, payload in fake.calls_named("update") if name == "tracks"]


def test_genre_is_backfilled_from_the_tag_when_the_track_has_none(monkeypatch):
    fake = FakeSupabase(rows={"tracks": [{"file_ref": "u/t.mp3", "genre": None}]})
    monkeypatch.setattr(extraction, "get_service_client", lambda: fake)
    monkeypatch.setattr("app.services.audio_analysis.analyze_file", lambda path: _result())
    monkeypatch.setattr(extraction, "read_tags_from_path", lambda path: _tags(genre="Amapiano"))

    extraction.run_extraction(TRACK_ID)

    assert _genre_updates(fake) == [{"genre": "Amapiano"}]


def test_an_existing_genre_is_never_overwritten(monkeypatch):
    # Upload lets a typed-in genre beat the tag. Re-analysing must not undo that.
    fake = FakeSupabase(rows={"tracks": [{"file_ref": "u/t.mp3", "genre": "Afro House"}]})
    monkeypatch.setattr(extraction, "get_service_client", lambda: fake)
    monkeypatch.setattr("app.services.audio_analysis.analyze_file", lambda path: _result())
    monkeypatch.setattr(extraction, "read_tags_from_path", lambda path: _tags(genre="Amapiano"))

    extraction.run_extraction(TRACK_ID)

    assert _genre_updates(fake) == []


def test_a_track_with_no_genre_tag_leaves_the_column_alone(monkeypatch):
    fake = FakeSupabase(rows={"tracks": [{"file_ref": "u/t.mp3", "genre": None}]})
    monkeypatch.setattr(extraction, "get_service_client", lambda: fake)
    monkeypatch.setattr("app.services.audio_analysis.analyze_file", lambda path: _result())
    monkeypatch.setattr(extraction, "read_tags_from_path", lambda path: _tags(genre=None))

    extraction.run_extraction(TRACK_ID)

    assert _genre_updates(fake) == []


def test_genre_is_backfilled_even_when_the_audio_is_too_short_to_analyse(monkeypatch):
    # A one-shot still has tags. Refusing to analyse it should not also mean
    # refusing to record what the file says about itself.
    fake = FakeSupabase(rows={"tracks": [{"file_ref": "u/t.mp3", "genre": None}]})
    monkeypatch.setattr(extraction, "get_service_client", lambda: fake)
    monkeypatch.setattr(extraction, "read_tags_from_path", lambda path: _tags(genre="Hip Hop/Rap"))

    def _too_short(path):
        raise ValueError("Too short to analyse: 1.5s, minimum 30s.")

    monkeypatch.setattr("app.services.audio_analysis.analyze_file", _too_short)

    extraction.run_extraction(TRACK_ID)

    assert _genre_updates(fake) == [{"genre": "Hip Hop/Rap"}]
    assert _updates(fake)[-1]["status"] == "failed"


def test_extraction_uses_the_service_role_client():
    # A background task has no request context, so it cannot borrow a user JWT.
    # If this ever switches to the user client, extraction silently stops working.
    import inspect

    source = inspect.getsource(extraction.run_extraction)
    assert "get_service_client()" in source
