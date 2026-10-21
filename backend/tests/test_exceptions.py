"""
HealthSync AI — Exception Handling & RFC 7807 Error Envelope Tests
"""

import pytest
from fastapi import APIRouter, status
from fastapi.testclient import TestClient
from app.core.exceptions import ProblemDetailException
from app.main import app


def test_404_not_found_envelope(client: TestClient):
    """Verify that 404 responses conform to RFC 7807 problem details specification."""
    response = client.get("/api/v1/non-existent-endpoint-path")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.headers.get("Content-Type") == "application/problem+json"

    data = response.json()
    assert data["status"] == 404
    assert data["title"] == "Resource Not Found"
    assert "detail" in data
    assert data["instance"] == "/api/v1/non-existent-endpoint-path"
    assert "type" in data


def test_405_method_not_allowed_envelope(client: TestClient):
    """Verify that calling an unsupported HTTP method returns RFC 7807 405 response."""
    # POST to /health which only supports GET
    response = client.post("/health")
    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    assert response.headers.get("Content-Type") == "application/problem+json"

    data = response.json()
    assert data["status"] == 405
    assert data["title"] == "Method Not Allowed"
    assert data["instance"] == "/health"


def test_internal_server_error_sanitization(client: TestClient):
    """
    Verify that unhandled exceptions yield safe 500 responses without exposing
    internal tracebacks or stack traces to clients.
    """
    # Dynamically inject a temporary route that triggers an unhandled ZeroDivisionError
    faulty_router = APIRouter()

    @faulty_router.get("/test-internal-failure")
    def trigger_crash():
        return 1 / 0

    app.include_router(faulty_router)

    with TestClient(app, raise_server_exceptions=False) as safe_client:
        response = safe_client.get("/test-internal-failure")
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.headers.get("Content-Type") == "application/problem+json"

    data = response.json()
    assert data["status"] == 500
    assert data["title"] == "Internal Server Error"
    # Ensure zero stack trace, python file names, or code lines are leaked
    assert "Traceback" not in data["detail"]
    assert "ZeroDivisionError" not in data["detail"]
    assert "An unexpected internal error occurred" in data["detail"]


def test_validation_error_rfc7807_envelope(client: TestClient):
    """
    Verify that Pydantic schema validation failures trigger a 422 RFC 7807 response
    containing structured invalid_params.
    """
    from app.schemas.diabetes import DiabetesInput
    test_validation_router = APIRouter()

    @test_validation_router.post("/test-validation")
    def receive_data(payload: DiabetesInput):
        return {"status": "ok"}

    app.include_router(test_validation_router)

    # Post payload with invalid glucose (30 < 40) and missing required fields
    invalid_payload = {
        "glucose": 30.0,
    }
    response = client.post("/test-validation", json=invalid_payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert response.headers.get("Content-Type") == "application/problem+json"

    data = response.json()
    assert data["status"] == 422
    assert data["title"] == "Biomarker Validation Error"
    assert data["type"] == "https://api.healthsync.ai/errors/validation-failed"
    assert "invalid_params" in data
    assert len(data["invalid_params"]) > 0
    param_names = [p["name"] for p in data["invalid_params"]]
    assert any("glucose" in p for p in param_names)


def test_custom_problem_detail_exception(client: TestClient):
    """Verify that explicitly raised ProblemDetailException formats properly."""
    custom_router = APIRouter()

    @custom_router.get("/test-custom-problem")
    def trigger_problem():
        raise ProblemDetailException(
            status_code=status.HTTP_409_CONFLICT,
            title="Duplicate Screening Submission",
            detail="An assessment with the same idempotent key is already being processed.",
            error_type="https://api.healthsync.ai/errors/duplicate-assessment",
        )

    app.include_router(custom_router)

    response = client.get("/test-custom-problem")
    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.headers.get("Content-Type") == "application/problem+json"

    data = response.json()
    assert data["status"] == 409
    assert data["title"] == "Duplicate Screening Submission"
    assert data["type"] == "https://api.healthsync.ai/errors/duplicate-assessment"
    assert "idempotent key" in data["detail"]

