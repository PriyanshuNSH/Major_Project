"""
HealthSync AI — Health Risk Modules Catalog Endpoint Tests
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient


def test_list_active_modules(client: TestClient):
    """Verify that /api/v1/modules returns active disease estimation modules."""
    response = client.get("/api/v1/modules")
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["success"] is True
    assert "data" in body
    modules = body["data"]
    assert len(modules) >= 2

    module_ids = [m["module_id"] for m in modules]
    assert "diabetes" in module_ids
    assert "heart_disease" in module_ids

    # Validate schema fields
    for mod in modules:
        assert "display_name" in mod
        assert "model_version" in mod
        assert "description" in mod
        assert mod["is_active"] is True
        assert mod["features_count"] > 0


def test_get_diabetes_module_detail(client: TestClient):
    """Verify module feature specification and boundary constraints for diabetes."""
    response = client.get("/api/v1/modules/diabetes")
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["module_id"] == "diabetes"
    assert "Type 2 Diabetes" in data["display_name"]
    assert "disclaimer" in data
    assert "Informational risk estimation only" in data["disclaimer"]
    assert len(data["features"]) >= 7

    # Ensure biomarker boundary definitions exist
    glucose_feature = next((f for f in data["features"] if f["name"] == "glucose"), None)
    assert glucose_feature is not None
    assert glucose_feature["min_allowed"] == 40.0
    assert glucose_feature["max_allowed"] == 400.0
    assert glucose_feature["unit"] == "mg/dL"


def test_get_heart_disease_module_detail(client: TestClient):
    """Verify module feature specification and boundary constraints for heart disease."""
    response = client.get("/api/v1/modules/heart_disease")
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["module_id"] == "heart_disease"
    assert "Cardiovascular" in data["display_name"]
    assert len(data["features"]) >= 10

    # Ensure cholesterol and blood pressure definitions exist
    chol_feature = next((f for f in data["features"] if f["name"] == "serum_cholesterol"), None)
    assert chol_feature is not None
    assert chol_feature["min_allowed"] == 100.0
    assert chol_feature["max_allowed"] == 600.0


def test_get_unknown_module_returns_rfc7807_404(client: TestClient):
    """Verify querying an unregistered module triggers an RFC 7807 404 response."""
    response = client.get("/api/v1/modules/oncology_screening")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.headers.get("Content-Type") == "application/problem+json"
    error = response.json()
    assert error["status"] == 404
    assert error["title"] == "Module Not Found"
    assert "oncology_screening" in error["detail"]
    assert error["instance"] == "/api/v1/modules/oncology_screening"
    assert error["type"] == "https://api.healthsync.ai/errors/module-not-found"
