"""
HealthSync AI — Type 2 Diabetes Risk Input & Response Schemas
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


class DiabetesInput(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )

    glucose: float = Field(
        ...,
        ge=40.0,
        le=400.0,
        description="Fasting blood plasma glucose in mg/dL (feasible biological range: 40–400)",
        examples=[118.0],
    )
    blood_pressure_systolic: float = Field(
        ...,
        ge=60.0,
        le=250.0,
        description="Resting systolic arterial blood pressure in mmHg (feasible range: 60–250)",
        examples=[128.0],
    )
    blood_pressure_diastolic: float = Field(
        ...,
        ge=40.0,
        le=150.0,
        description="Resting diastolic arterial blood pressure in mmHg (feasible range: 40–150)",
        examples=[82.0],
    )
    bmi: float = Field(
        ...,
        ge=10.0,
        le=65.0,
        description="Body Mass Index in kg/m² (feasible range: 10–65)",
        examples=[28.4],
    )
    age: int = Field(
        ...,
        ge=18,
        le=120,
        description="Chronological age in completed years (minimum 18)",
        examples=[42],
    )
    physical_activity_hours_week: float = Field(
        ...,
        ge=0.0,
        le=35.0,
        description="Estimated weekly moderate-to-vigorous aerobic exercise in hours",
        examples=[2.5],
    )
    family_history_diabetes: bool = Field(
        ...,
        description="First-degree direct biological relative (parent or sibling) diagnosed with diabetes",
        examples=[True],
    )
    insulin: Optional[float] = Field(
        None,
        ge=0.0,
        le=900.0,
        description="2-Hour fasting serum insulin in µU/mL (optional clinical marker)",
        examples=[85.0],
    )
    skin_thickness: Optional[float] = Field(
        None,
        ge=0.0,
        le=99.0,
        description="Triceps skin fold thickness in mm (optional clinical marker)",
        examples=[28.0],
    )
    pregnancies: Optional[int] = Field(
        None,
        ge=0,
        le=20,
        description="Total number of times pregnant (if biologically applicable)",
        examples=[2],
    )

    @model_validator(mode="after")
    def validate_hemodynamic_consistency(self) -> "DiabetesInput":
        if self.blood_pressure_diastolic >= self.blood_pressure_systolic:
            raise ValueError(
                f"Diastolic blood pressure ({self.blood_pressure_diastolic} mmHg) must be strictly "
                f"lower than systolic blood pressure ({self.blood_pressure_systolic} mmHg)."
            )
        return self


class ShapDriverDetail(BaseModel):
    feature: str = Field(..., description="Biomarker variable identifier")
    display_name: str = Field(..., description="Clinical label")
    feature_value: Any = Field(..., description="Observed input value")
    shap_impact: float = Field(..., description="Additive Shapley impact (+ increases risk, - protective)")
    direction: str = Field(..., description="'RISK_ELEVATING' or 'PROTECTIVE'")
    clinical_context: str = Field(..., description="Evidence-based interpretation of the impact")


class DiabetesAssessmentResponse(BaseModel):
    assessment_id: str
    module_id: str = "diabetes"
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
