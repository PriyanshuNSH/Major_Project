"""
HealthSync AI — Health Risk Module Discovery Schemas
"""

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class BiomarkerFeatureSchema(BaseModel):
    name: str = Field(..., description="Machine-readable feature variable identifier")
    display_name: str = Field(..., description="Clinically descriptive human-readable label")
    data_type: str = Field(..., description="Expected primitive type (float, integer, boolean)")
    unit: Optional[str] = Field(None, description="Standard clinical measurement unit (e.g. mg/dL, mmHg)")
    min_allowed: Optional[float] = Field(None, description="Lower physiological feasibility bound")
    max_allowed: Optional[float] = Field(None, description="Upper physiological feasibility bound")
    required: bool = Field(True, description="Whether the biomarker is mandatory for model evaluation")
    description: str = Field(..., description="Clinical description of the physiological marker")
    options: Optional[List[Any]] = Field(None, description="Permissible discrete values for categorical markers")


class HealthModuleSummary(BaseModel):
    module_id: str = Field(..., description="Unique engine identifier (e.g. diabetes, heart_disease)")
    display_name: str = Field(..., description="Human-readable module title")
    model_version: str = Field(..., description="Active deployed model semantic version")
    description: str = Field(..., description="High-level clinical purpose of the risk engine")
    features_count: int = Field(..., description="Number of physiological biomarker features evaluated")
    is_active: bool = Field(True, description="Whether the module is enabled for inference requests")


class HealthModuleDetail(HealthModuleSummary):
    benchmark_dataset: str = Field(..., description="Reference training cohort (e.g., CDC BRFSS, UCI Cleveland)")
    algorithm: str = Field(..., description="Underlying calibrated machine learning algorithm family")
    calibration_method: str = Field(..., description="Probability calibration technique applied (e.g., isotonic, Platt)")
    features: List[BiomarkerFeatureSchema] = Field(..., description="Complete schema of required biomarker inputs")
    disclaimer: str = Field(..., description="Mandatory medical non-diagnostic regulatory statement")
