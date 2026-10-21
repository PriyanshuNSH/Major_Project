"""
HealthSync AI — Clinical Risk Assessment & Inference Endpoints

Protocol: RESTful JSON over HTTPS
Specification: OpenAPI 3.1 & RFC 7807 (Problem Details)
Mandatory Notice: Informational risk estimation only. Not a medical diagnosis.
"""

from typing import List, Optional
from fastapi import APIRouter, Header, Query, status

from app.core.exceptions import ProblemDetailException
from app.engines.diabetes import DiabetesRiskEngine
from app.engines.heart import HeartDiseaseRiskEngine
from app.engines.registry import RiskEngineRegistry
from app.schemas.common import EngineStatusResponse, SuccessEnvelope
from app.schemas.diabetes import DiabetesAssessmentResponse, DiabetesInput
from app.schemas.heart import HeartAssessmentResponse, HeartDiseaseInput

router = APIRouter(prefix="/assessments", tags=["Assessments"])


def _resolve_demo_flag(demo_query: bool, demo_header: Optional[str]) -> bool:
    """Helper to detect explicit demonstration mode from query parameter or header."""
    if demo_query:
        return True
    if demo_header and demo_header.strip().lower() in ("true", "1", "yes", "demo"):
        return True
    return False


@router.get(
    "/status",
    response_model=SuccessEnvelope[List[EngineStatusResponse]],
    status_code=status.HTTP_200_OK,
    summary="List ML Engine Readiness & Artifact Status",
    description="Inspects registered risk engines and verifies whether genuine trained model artifacts exist on disk.",
)
async def list_engine_statuses() -> SuccessEnvelope[List[EngineStatusResponse]]:
    statuses = RiskEngineRegistry.get_statuses()
    return SuccessEnvelope(data=statuses)


@router.get(
    "/{module_id}/status",
    response_model=SuccessEnvelope[EngineStatusResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Specific Engine Status",
    description="Retrieves live artifact availability and readiness status for an individual risk module.",
    responses={
        404: {"description": "Module not registered in engine registry"},
    },
)
async def get_engine_status(module_id: str) -> SuccessEnvelope[EngineStatusResponse]:
    engine_status = RiskEngineRegistry.get_status(module_id)
    if not engine_status:
        raise ProblemDetailException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Module Not Found",
            detail=f"Risk module '{module_id}' is not recognized in the engine registry.",
            error_type="https://api.healthsync.ai/errors/module-not-found",
        )
    return SuccessEnvelope(data=engine_status)


@router.post(
    "/diabetes/estimate",
    response_model=SuccessEnvelope[DiabetesAssessmentResponse],
    status_code=status.HTTP_200_OK,
    summary="Execute Diabetes Risk Screening",
    description=(
        "Evaluates metabolic and glycemic biomarkers against calibrated models. "
        "Returns HTTP 503 if genuine model artifact is unbound, unless demonstration mode is explicitly requested."
    ),
    responses={
        422: {"description": "Biomarker schema validation failure (RFC 7807)"},
        503: {"description": "ML pipeline model artifact unavailable (RFC 7807)"},
    },
)
async def estimate_diabetes_risk(
    input_data: DiabetesInput,
    demo: bool = Query(
        False,
        description="Explicitly allow reference demonstration baseline when model artifact is unbound",
    ),
    x_healthsync_demo_mode: Optional[str] = Header(
        None,
        alias="X-HealthSync-Demo-Mode",
        description="Optional header allowing prototype demonstration execution",
    ),
) -> SuccessEnvelope[DiabetesAssessmentResponse]:
    engine = RiskEngineRegistry.get("diabetes")
    if not engine or not isinstance(engine, DiabetesRiskEngine):
        raise ProblemDetailException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            title="Engine Unavailable",
            detail="The Type 2 Diabetes Risk Engine is not initialized.",
            error_type="https://api.healthsync.ai/errors/engine-unavailable",
        )

    allow_demo = _resolve_demo_flag(demo, x_healthsync_demo_mode)
    assessment = engine.estimate(input_data, allow_demo=allow_demo)
    return SuccessEnvelope(data=assessment)


@router.post(
    "/heart-disease/estimate",
    response_model=SuccessEnvelope[HeartAssessmentResponse],
    status_code=status.HTTP_200_OK,
    summary="Execute Cardiovascular Risk Screening",
    description=(
        "Evaluates resting ECG, serum lipids, and stress biomarkers against calibrated models. "
        "Returns HTTP 503 if genuine model artifact is unbound, unless demonstration mode is explicitly requested."
    ),
    responses={
        422: {"description": "Biomarker schema validation failure (RFC 7807)"},
        503: {"description": "ML pipeline model artifact unavailable (RFC 7807)"},
    },
)
@router.post(
    "/heart_disease/estimate",
    response_model=SuccessEnvelope[HeartAssessmentResponse],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,  # Alias route for underscore compatibility
)
async def estimate_heart_disease_risk(
    input_data: HeartDiseaseInput,
    demo: bool = Query(
        False,
        description="Explicitly allow reference demonstration baseline when model artifact is unbound",
    ),
    x_healthsync_demo_mode: Optional[str] = Header(
        None,
        alias="X-HealthSync-Demo-Mode",
        description="Optional header allowing prototype demonstration execution",
    ),
) -> SuccessEnvelope[HeartAssessmentResponse]:
    engine = RiskEngineRegistry.get("heart_disease")
    if not engine or not isinstance(engine, HeartDiseaseRiskEngine):
        raise ProblemDetailException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            title="Engine Unavailable",
            detail="The Cardiovascular Risk Engine is not initialized.",
            error_type="https://api.healthsync.ai/errors/engine-unavailable",
        )

    allow_demo = _resolve_demo_flag(demo, x_healthsync_demo_mode)
    assessment = engine.estimate(input_data, allow_demo=allow_demo)
    return SuccessEnvelope(data=assessment)
