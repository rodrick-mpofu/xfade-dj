"""Settings parsing.

These exist because a startup-only failure is invisible to every other test in the
suite: the app booted fine under pytest (which never sets CORS_ORIGINS, so the
default applied) while crashing on boot in Docker, where the .env file does set it.
"""

import pytest

from app.config import Settings

REQUIRED = {
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_ANON_KEY": "anon",
    "SUPABASE_SERVICE_ROLE_KEY": "service",
}


@pytest.fixture
def env(monkeypatch):
    def _set(**overrides):
        # _env_file="" stops pydantic-settings reading a developer's real .env,
        # which would make these pass or fail depending on the machine.
        for key, value in {**REQUIRED, **overrides}.items():
            monkeypatch.setenv(key, value)
        return lambda: Settings(_env_file="")

    return _set


def test_comma_separated_origins_parse(env):
    build = env(CORS_ORIGINS="http://localhost:5173,https://xfade.example")
    assert build().cors_origins == ["http://localhost:5173", "https://xfade.example"]


def test_a_single_origin_parses(env):
    assert env(CORS_ORIGINS="http://localhost:5173")().cors_origins == [
        "http://localhost:5173"
    ]


def test_surrounding_whitespace_is_trimmed(env):
    build = env(CORS_ORIGINS=" http://a.example , http://b.example ")
    assert build().cors_origins == ["http://a.example", "http://b.example"]


def test_empty_entries_are_dropped(env):
    assert env(CORS_ORIGINS="http://a.example,,")().cors_origins == ["http://a.example"]


def test_json_list_still_works(env):
    # The documented pydantic-settings form should not have been broken by NoDecode.
    build = env(CORS_ORIGINS='["http://a.example", "http://b.example"]')
    assert build().cors_origins == ["http://a.example", "http://b.example"]


def test_default_applies_when_unset(env):
    build = env()
    assert build().cors_origins == ["http://localhost:5173"]


def test_missing_required_settings_raise(monkeypatch):
    for key in REQUIRED:
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(Exception):
        Settings(_env_file="")
