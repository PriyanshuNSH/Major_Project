"""
HealthSync AI — Pytest Configuration & Test Fixtures
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Synchronous FastAPI TestClient fixture for endpoint integration testing."""
    with TestClient(app) as test_client:
        yield test_client
