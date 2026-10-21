"""
HealthSync AI — Health Risk Module Discovery Endpoints
"""

from typing import List
from fastapi import APIRouter, status
from app.core.exceptions import ProblemDetailException
from app.engines.registry import RiskEngineRegistry
from app.schemas.common import SuccessEnvelope
from app.schemas.modules import HealthModuleDetail, HealthModuleSummary

router = APIRouter(prefix="/modules", tags=["Modules"])


@router.get(
    "",
    response_model=SuccessEnvelope[List[HealthModuleSummary]],
    status_code=status.HTTP_200_OK,
    summary="List Registered Risk Engines",
    description="Returns a catalog of active clinical screening modules available in the platform.",
)
async def list_modules() -> SuccessEnvelope[List[HealthModuleSummary]]:
    modules = RiskEngineRegistry.list_modules()
    return SuccessEnvelope(data=modules)


@router.get(
    "/{module_id}",
    response_model=SuccessEnvelope[HealthModuleDetail],
    status_code=status.HTTP_200_OK,
    summary="Get Module Feature Specification",
    description="Retrieves the complete biomarker schema, physiological boundaries, and calibration metadata for a specific module.",
    responses={
        404: {
            "description": "Risk module not found in engine registry",
        }
    },
)
async def get_module_detail(module_id: str) -> SuccessEnvelope[HealthModuleDetail]:
    detail = RiskEngineRegistry.get_module_detail(module_id.lower())
    if not detail:
        raise ProblemDetailException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Module Not Found",
            detail=f"Health Risk Engine module '{module_id}' is not registered or enabled.",
            error_type="https://api.healthsync.ai/errors/module-not-found",
        )
    return SuccessEnvelope(data=detail)
