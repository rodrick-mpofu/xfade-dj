"""Test fixtures.

Settings are populated with dummy values before the app is imported, so the suite
runs without a real Supabase project. Nothing here reaches the network: the routes
under test either don't call out, or get a fake client injected.
"""

import os
from collections.abc import Callable, Iterator

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("ENVIRONMENT", "test")

TEST_USER_ID = "11111111-1111-4111-8111-111111111111"


@pytest.fixture
def client():
    """Unauthenticated client — real dependencies, so auth is actually enforced."""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def authed_client() -> Iterator[Callable]:
    """Factory: call with a FakeSupabase to get a client authenticated as TEST_USER_ID."""
    from fastapi.testclient import TestClient

    from app.api.deps import CurrentUser, get_current_user, get_db
    from app.main import app

    def _build(fake_db) -> TestClient:
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id=TEST_USER_ID, email="dj@example.com", access_token="test-token"
        )
        app.dependency_overrides[get_db] = lambda: fake_db
        return TestClient(app)

    yield _build
    app.dependency_overrides.clear()
