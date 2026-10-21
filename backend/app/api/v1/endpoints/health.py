"""
HealthSync AI — Health Check Endpoint
"""

from datetime import datetime
from fastapi import APIRouter, status
from app.api.deps import CurrentSettings
from app.schemas.common import HealthCheckResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Service Liveness & Health Probe",
    description="Returns the active runtime health state, application version, and environment metadata.",
)
async def check_health(settings: CurrentSettings) -> HealthCheckResponse:
    return HealthCheckResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )
