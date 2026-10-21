"""
HealthSync AI — OpenAPI Documentation & CORS Middleware Tests
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient


def test_openapi_json_schema(client: TestClient):
    """Verify that OpenAPI 3.1 specification is generated correctly."""
    response = client.get("/openapi.json")
    assert response.status_code == status.HTTP_200_OK
    schema = response.json()
    assert "openapi" in schema
    assert "info" in schema
    assert "HealthSync AI" in schema["info"]["title"]
    assert "paths" in schema
    assert "/health" in schema["paths"]
    assert "/api/v1/health" in schema["paths"]
    assert "/api/v1/modules" in schema["paths"]
    assert "/api/v1/modules/{module_id}" in schema["paths"]


def test_swagger_docs_endpoint(client: TestClient):
    """Verify that Swagger UI documentation is accessible."""
    response = client.get("/docs")
    assert response.status_code == status.HTTP_200_OK
    assert "swagger-ui" in response.text.lower() or "html" in response.text.lower()


def test_cors_preflight_headers(client: TestClient):
    """Verify that CORS preflight OPTIONS request returns appropriate headers for frontend."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization,Content-Type",
    }
    response = client.options("/api/v1/modules", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "GET" in response.headers.get("access-control-allow-methods", "")
