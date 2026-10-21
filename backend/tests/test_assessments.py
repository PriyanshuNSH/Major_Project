"""
HealthSync AI — Automated Integration Tests for Assessment Endpoints & Model Registry

Verifies:
1. Status probes for ML model availability.
2. 503 Service Unavailable when model artifacts are unbound.
3. 422 Unprocessable Entity when biomarker boundaries are violated (RFC 7807).
4. Demonstration baseline mode execution with mandatory clinical notices.
5. Hemodynamic consistency enforcement (diastolic < systolic).
"""

import pytest
from fastapi.testclient import TestClient


def test_assessments_status_endpoint(client: TestClient):
    """Verifies that the /assessments/status endpoint returns readiness of all registered engines."""
    response = client.get("/api/v1/assessments/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    assert isinstance(data, list)
    assert len(data) >= 2

    module_ids = [m["module_id"] for m in data]
    assert "diabetes" in module_ids
    assert "heart_disease" in module_ids

    # Verify that in this development phase without trained artifacts, status is MODEL_UNAVAILABLE
    for module_status in data:
        assert module_status["status"] == "MODEL_UNAVAILABLE"
        assert module_status["is_ready"] is False
        assert "not found" in module_status["message"].lower() or "unavailable" in module_status["message"].lower()


def test_single_module_status_endpoint(client: TestClient):
    """Verifies module-specific status lookup and 404 for unknown modules."""
    res_diabetes = client.get("/api/v1/assessments/diabetes/status")
    assert res_diabetes.status_code == 200
    assert res_diabetes.json()["data"]["module_id"] == "diabetes"

    res_unknown = client.get("/api/v1/assessments/unknown_module/status")
    assert res_unknown.status_code == 404
    assert res_unknown.headers["content-type"] == "application/problem+json"


def test_diabetes_estimate_missing_artifact_returns_503(client: TestClient):
    """Verifies that calling estimate without demo mode returns RFC 7807 503 because artifact is missing."""
    valid_payload = {
        "glucose": 118.0,
        "blood_pressure_systolic": 124.0,
        "blood_pressure_diastolic": 78.0,
        "bmi": 26.5,
        "age": 45,
        "physical_activity_hours_week": 3.0,
        "family_history_diabetes": False,
    }
    response = client.post("/api/v1/assessments/diabetes/estimate", json=valid_payload)
    assert response.status_code == 503
    assert response.headers["content-type"] == "application/problem+json"
    problem = response.json()
    assert problem["status"] == 503
    assert problem["title"] == "Model Artifact Unavailable"
    assert "not present or loaded" in problem["detail"]


def test_heart_estimate_missing_artifact_returns_503(client: TestClient):
    """Verifies that calling heart estimate without demo mode returns RFC 7807 503."""
    valid_payload = {
        "age": 52,
        "sex": 1,
        "chest_pain_type": 1,
        "resting_bp": 130.0,
        "serum_cholesterol": 210.0,
        "fasting_blood_sugar": False,
        "resting_ecg": 0,
        "max_heart_rate": 150.0,
        "exercise_angina": False,
        "oldpeak": 0.5,
        "st_slope": 1,
    }
    response = client.post("/api/v1/assessments/heart-disease/estimate", json=valid_payload)
    assert response.status_code == 503
    assert response.headers["content-type"] == "application/problem+json"
    problem = response.json()
    assert problem["status"] == 503
    assert problem["title"] == "Model Artifact Unavailable"


def test_diabetes_estimate_demo_mode_succeeds_with_mandatory_notice(client: TestClient):
    """Verifies that explicitly requesting demo mode returns labeled demonstration baseline."""
    valid_payload = {
        "glucose": 135.0,
        "bloodPressureSystolic": 130.0,
        "bloodPressureDiastolic": 82.0,
        "bmi": 29.1,
        "age": 50,
        "physicalActivityHoursWeek": 1.5,
        "familyHistoryDiabetes": True,
    }
    response = client.post("/api/v1/assessments/diabetes/estimate?demo=true", json=valid_payload)
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["module_id"] == "diabetes"
    assert data["is_demonstration_data"] is True
    assert (
        data["demonstration_notice"]
        == "Prototype Demonstration Baseline (Epidemiological Reference Calibration) — Real model artifact binding in progress."
    )
    assert (
        data["disclaimer"]
        == "Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional."
    )
    assert 0.0 <= data["risk_score"] <= 1.0
    assert data["risk_level"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")
    assert len(data["drivers"]) > 0


def test_heart_estimate_demo_header_succeeds(client: TestClient):
    """Verifies that X-HealthSync-Demo-Mode header enables demonstration baseline."""
    valid_payload = {
        "age": 60,
        "sex": 1,
        "chestPainType": 0,
        "restingBp": 140.0,
        "serumCholesterol": 260.0,
        "fastingBloodSugar": True,
        "restingEcg": 1,
        "maxHeartRate": 130.0,
        "exerciseAngina": True,
        "oldpeak": 2.2,
        "stSlope": 2,
    }
    response = client.post(
        "/api/v1/assessments/heart-disease/estimate",
        json=valid_payload,
        headers={"X-HealthSync-Demo-Mode": "true"},
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["module_id"] == "heart_disease"
    assert data["is_demonstration_data"] is True
    assert (
        data["demonstration_notice"]
        == "Prototype Demonstration Baseline (Epidemiological Reference Calibration) — Real model artifact binding in progress."
    )


def test_diabetes_validation_error_rfc7807(client: TestClient):
    """Verifies that out-of-boundary values return RFC 7807 422 with invalid_params list."""
    invalid_payload = {
        "glucose": 999.0,  # exceeds max 400
        "blood_pressure_systolic": 120.0,
        "blood_pressure_diastolic": 80.0,
        "bmi": 25.0,
        "age": 12,  # under minimum 18
        "physical_activity_hours_week": 100.0,  # exceeds max 35
        "family_history_diabetes": False,
    }
    response = client.post("/api/v1/assessments/diabetes/estimate?demo=true", json=invalid_payload)
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
    problem = response.json()
    assert problem["status"] == 422
    assert problem["title"] == "Biomarker Validation Error"
    invalid_fields = [p["name"] for p in problem["invalid_params"]]
    assert any("glucose" in f for f in invalid_fields)
    assert any("age" in f for f in invalid_fields)
    assert any("physical_activity_hours_week" in f or "physicalActivityHoursWeek" in f for f in invalid_fields)


def test_hemodynamic_consistency_rejection(client: TestClient):
    """Verifies that diastolic >= systolic is rejected with 422."""
    inconsistent_payload = {
        "glucose": 110.0,
        "blood_pressure_systolic": 110.0,
        "blood_pressure_diastolic": 120.0,  # diastolic > systolic!
        "bmi": 24.0,
        "age": 35,
        "physical_activity_hours_week": 4.0,
        "family_history_diabetes": False,
    }
    response = client.post("/api/v1/assessments/diabetes/estimate?demo=true", json=inconsistent_payload)
    assert response.status_code == 422
    problem = response.json()
    assert problem["status"] == 422
    assert any("diastolic" in p["reason"].lower() for p in problem["invalid_params"])


def test_heart_validation_error_rfc7807(client: TestClient):
    """Verifies that invalid cardiovascular biomarkers return RFC 7807 422."""
    invalid_payload = {
        "age": 15,  # under 18
        "sex": 3,  # invalid sex (only 0 or 1 allowed)
        "chestPainType": 9,  # invalid range (0..3)
        "restingBp": 350.0,  # exceeds 260
        "serumCholesterol": 50.0,  # below 100
        "fastingBloodSugar": False,
        "restingEcg": 5,  # invalid range (0..2)
        "maxHeartRate": 300.0,  # exceeds 220
        "exerciseAngina": False,
        "oldpeak": -2.0,  # below 0.0
        "stSlope": 4,  # invalid range (0..2)
    }
    response = client.post(
        "/api/v1/assessments/heart-disease/estimate?demo=true",
        json=invalid_payload,
    )
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
    problem = response.json()
    assert problem["status"] == 422
    assert problem["title"] == "Biomarker Validation Error"
    invalid_names = [p["name"] for p in problem["invalid_params"]]
    assert any("age" in n for n in invalid_names)
    assert any("sex" in n for n in invalid_names)
    assert any("resting_bp" in n or "restingBp" in n for n in invalid_names)


def test_missing_required_fields_returns_422(client: TestClient):
    """Verifies that empty or incomplete request payloads return RFC 7807 422."""
    res_diabetes = client.post("/api/v1/assessments/diabetes/estimate?demo=true", json={})
    assert res_diabetes.status_code == 422
    prob_db = res_diabetes.json()
    assert prob_db["status"] == 422
    assert len(prob_db["invalid_params"]) > 0

    res_heart = client.post("/api/v1/assessments/heart-disease/estimate?demo=true", json={})
    assert res_heart.status_code == 422
    prob_ht = res_heart.json()
    assert prob_ht["status"] == 422
    assert len(prob_ht["invalid_params"]) > 0


def test_strict_model_unavailable_protection_prevents_unverified_predictions(client: TestClient):
    """
    Verifies that neither module can ever produce a successful prediction response
    when its genuine model artifact is unbound on disk, protecting against fabricated results.
    """
    db_payload = {
        "glucose": 115.0,
        "blood_pressure_systolic": 120.0,
        "blood_pressure_diastolic": 80.0,
        "bmi": 25.0,
        "age": 40,
        "physical_activity_hours_week": 3.0,
        "family_history_diabetes": False,
    }
    ht_payload = {
        "age": 50,
        "sex": 1,
        "chest_pain_type": 1,
        "resting_bp": 120.0,
        "serum_cholesterol": 200.0,
        "fasting_blood_sugar": False,
        "resting_ecg": 0,
        "max_heart_rate": 150.0,
        "exercise_angina": False,
        "oldpeak": 0.5,
        "st_slope": 1,
    }

    # Diabetes without demo flag must return 503
    db_res = client.post("/api/v1/assessments/diabetes/estimate", json=db_payload)
    assert db_res.status_code == 503
    assert db_res.json()["title"] == "Model Artifact Unavailable"

    # Heart disease without demo flag must return 503
    ht_res = client.post("/api/v1/assessments/heart-disease/estimate", json=ht_payload)
    assert ht_res.status_code == 503
    assert ht_res.json()["title"] == "Model Artifact Unavailable"

