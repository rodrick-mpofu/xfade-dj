"""Test fixtures.

Settings are populated with dummy values before the app is imported, so the suite
runs without a real Supabase project. Nothing here reaches the network — the tests
below only exercise routes that don't call out.
"""

import os

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("ENVIRONMENT", "test")


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
