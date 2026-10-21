"""
HealthSync AI — Cardiovascular / Heart Disease Risk Input & Response Schemas
"""

from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from app.schemas.diabetes import ShapDriverDetail


class HeartDiseaseInput(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )

    age: int = Field(
        ...,
        ge=18,
        le=120,
        description="Chronological age in completed years",
        examples=[54],
    )
    sex: int = Field(
        ...,
        ge=0,
        le=1,
        description="Biological sex (1 = Male, 0 = Female)",
        examples=[1],
    )
    chest_pain_type: int = Field(
        ...,
        ge=0,
        le=3,
        description="Chest pain presentation (0: Typical Angina, 1: Atypical Angina, 2: Non-anginal, 3: Asymptomatic)",
        examples=[1],
    )
    resting_bp: float = Field(
        ...,
        ge=60.0,
        le=260.0,
        description="Resting systemic arterial blood pressure in mmHg (feasible range: 60–260)",
        examples=[135.0],
    )
    serum_cholesterol: float = Field(
        ...,
        ge=100.0,
        le=600.0,
        description="Serum cholesterol in mg/dL (feasible range: 100–600)",
        examples=[230.0],
    )
    fasting_blood_sugar: bool = Field(
        ...,
        description="True if fasting blood glucose exceeds 120 mg/dL, False otherwise",
        examples=[False],
    )
    resting_ecg: int = Field(
        ...,
        ge=0,
        le=2,
        description="Resting electrocardiogram (0: Normal, 1: ST-T wave abnormality, 2: Left ventricular hypertrophy)",
        examples=[0],
    )
    max_heart_rate: float = Field(
        ...,
        ge=60.0,
        le=220.0,
        description="Maximum heart rate achieved during stress tolerance (feasible range: 60–220 bpm)",
        examples=[145.0],
    )
    exercise_angina: bool = Field(
        ...,
        description="Exercise-provoked angina (True = Yes, False = No)",
        examples=[False],
    )
    oldpeak: float = Field(
        ...,
        ge=0.0,
        le=10.0,
        description="ST depression induced by exercise relative to rest in mm (feasible range: 0.0–10.0)",
        examples=[1.2],
    )
    st_slope: int = Field(
        ...,
        ge=0,
        le=2,
        description="Slope of peak exercise ST segment (0: Upsloping, 1: Flat, 2: Downsloping)",
        examples=[1],
    )


class HeartAssessmentResponse(BaseModel):
    assessment_id: str
    module_id: str = "heart_disease"
    model_version: str
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Calibrated risk probability in [0.0, 1.0]")
    risk_level: str = Field(..., description="'LOW', 'MODERATE', 'HIGH', or 'CRITICAL'")
    confidence_interval: List[float] = Field(..., description="[lower_bound, upper_bound]")
    base_expected_risk: float = Field(..., description="Reference cohort expected baseline risk")
    drivers: List[ShapDriverDetail] = Field(..., description="Local SHAP feature decomposition")
    recommendations: List[str] = Field(..., description="Actionable lifestyle preventative guidance")
    disclaimer: str = Field(..., description="Mandatory non-diagnostic clinical disclaimer")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_demonstration_data: bool = False
    demonstration_notice: Optional[str] = None
