"""
HealthSync AI — Health & Liveness Probe Tests
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient


def test_root_index_endpoint(client: TestClient):
    """Verify that root endpoint returns service metadata, version, and disclaimer."""
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "online"
    assert "HealthSync" in data["name"]
    assert "version" in data
    assert "disclaimer" in data
    assert "Informational risk estimation only" in data["disclaimer"]


def test_root_health_probe(client: TestClient):
    """Verify that orchestrator /health probe returns 200 and healthy status."""
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "version" in data
    assert "environment" in data


def test_api_v1_health_probe(client: TestClient):
    """Verify that versioned /api/v1/health probe returns 200 with identical contract."""
    response = client.get("/api/v1/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "version" in data
