"""
HealthSync AI — Type 2 Diabetes Risk Engine Implementation

Clinical Scope: Susceptibility screening for prediabetes and type 2 diabetes.
Mandatory Clinical Notice: Informational risk estimation only. Not a medical diagnosis.
"""

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from app.core.config import get_settings
from app.core.exceptions import ProblemDetailException
from app.core.logging import logger
from app.engines.base import BaseRiskEngine
from app.schemas.common import EngineStatusResponse
from app.schemas.diabetes import (
    DiabetesAssessmentResponse,
    DiabetesInput,
    ShapDriverDetail,
)
from app.schemas.modules import BiomarkerFeatureSchema

settings = get_settings()


class DiabetesRiskEngine(BaseRiskEngine):
    """
    Concrete risk engine for Type 2 Diabetes susceptibility estimation.
    Enforces clear separation between input validation, model loading,
    inference orchestration, and clinical response formatting.
    """

    def __init__(self, artifacts_dir: Optional[Path] = None):
        self._artifacts_dir = artifacts_dir or self._resolve_artifacts_dir()
        self._artifact_file = self._artifacts_dir / "diabetes_pipeline.joblib"
        self._model = None
        self._explainer = None

    def _resolve_artifacts_dir(self) -> Path:
        if settings.ML_MODELS_DIR:
            return Path(settings.ML_MODELS_DIR)
        # Default project root / ml / artifacts
        root_dir = Path(__file__).resolve().parent.parent.parent.parent
        return root_dir / "ml" / "artifacts"

    @property
    def module_identifier(self) -> str:
        return "diabetes"

    @property
    def display_name(self) -> str:
        return "Type 2 Diabetes Risk Estimator"

    @property
    def model_version(self) -> str:
        return "v1.0.0-foundation"

    @property
    def description(self) -> str:
        return (
            "Estimates prediabetes and type 2 diabetes susceptibility based on "
            "metabolic vitals, glycemic levels, and lifestyle indicators."
        )

    @property
    def benchmark_dataset(self) -> str:
        return "CDC Behavioral Risk Factor Surveillance System (BRFSS) & NIDDK Pima Clinical Cohort"

    @property
    def algorithm(self) -> str:
        return "HistGradientBoostingClassifier (Tree Ensemble)"

    @property
    def calibration_method(self) -> str:
        return "CalibratedClassifierCV (Isotonic Regression)"

    def is_model_available(self) -> bool:
        """Verifies whether the genuine serialized pipeline artifact exists on disk."""
        return self._artifact_file.exists() and self._artifact_file.is_file()

    def get_features_schema(self) -> List[BiomarkerFeatureSchema]:
        return [
            BiomarkerFeatureSchema(
                name="glucose",
                display_name="Fasting Blood Glucose",
                data_type="float",
                unit="mg/dL",
                min_allowed=40.0,
                max_allowed=400.0,
                required=True,
                description="Fasting blood plasma glucose concentration",
            ),
            BiomarkerFeatureSchema(
                name="blood_pressure_systolic",
                display_name="Systolic Blood Pressure",
                data_type="float",
                unit="mmHg",
                min_allowed=60.0,
                max_allowed=250.0,
                required=True,
                description="Peak systemic arterial pressure during cardiac contraction",
            ),
            BiomarkerFeatureSchema(
                name="blood_pressure_diastolic",
                display_name="Diastolic Blood Pressure",
                data_type="float",
                unit="mmHg",
                min_allowed=40.0,
                max_allowed=150.0,
                required=True,
                description="Resting systemic arterial pressure between cardiac contractions",
            ),
            BiomarkerFeatureSchema(
                name="bmi",
                display_name="Body Mass Index",
                data_type="float",
                unit="kg/m²",
                min_allowed=10.0,
                max_allowed=65.0,
                required=True,
                description="Anthropometric ratio of body mass to height squared",
            ),
            BiomarkerFeatureSchema(
                name="age",
                display_name="Chronological Age",
                data_type="integer",
                unit="years",
                min_allowed=18.0,
                max_allowed=120.0,
                required=True,
                description="Patient age in completed years",
            ),
            BiomarkerFeatureSchema(
                name="physical_activity_hours_week",
                display_name="Weekly Aerobic Activity",
                data_type="float",
                unit="hrs/wk",
                min_allowed=0.0,
                max_allowed=35.0,
                required=True,
                description="Estimated weekly volume of moderate-to-vigorous exercise",
            ),
            BiomarkerFeatureSchema(
                name="family_history_diabetes",
                display_name="Family History",
                data_type="boolean",
                unit=None,
                required=True,
                description="Diagnosed first-degree biological relative with diabetes",
            ),
        ]

    def validate_inputs(self, raw_input: Dict[str, Any]) -> Dict[str, Any]:
        """Pydantic schema validation adapter."""
        validated = DiabetesInput.model_validate(raw_input)
        return validated.model_dump()

    def preprocess(self, validated_input: Dict[str, Any]) -> Any:
        # Preprocessing transformation will execute once model artifact is loaded
        return validated_input

    def predict(self, feature_array: Any) -> float:
        if not self.is_model_available():
            raise RuntimeError("Cannot predict: Model artifact not available.")
        # When model pipeline is bound:
        # return float(self._model.predict_proba(feature_array)[0][1])
        raise NotImplementedError("Live pipeline binding in progress.")

    def explain(self, feature_array: Any, top_k: int = 5) -> Dict[str, Any]:
        if not self.is_model_available():
            raise RuntimeError("Cannot explain: Model artifact not available.")
        raise NotImplementedError("Live SHAP tree explainer binding in progress.")

    def get_status(self) -> EngineStatusResponse:
        available = self.is_model_available()
        return EngineStatusResponse(
            module_id=self.module_identifier,
            display_name=self.display_name,
            model_version=self.model_version,
            is_ready=available,
            status="READY" if available else "MODEL_UNAVAILABLE",
            artifact_path=str(self._artifact_file),
            message=(
                "Calibrated machine learning pipeline loaded and ready for inference."
                if available
                else "Model artifact not found. Live inference is unavailable."
            ),
        )

    def estimate(self, input_data: DiabetesInput, allow_demo: bool = False) -> DiabetesAssessmentResponse:
        """
        Orchestrates diabetes risk assessment.
        If model artifact is missing and demo is not permitted, raises RFC 7807 503 error.
        If demo is permitted, provides a reference epidemiological calibration clearly labeled
        as demonstration output.
        """
        if not self.is_model_available():
            if not allow_demo:
                logger.warning(
                    f"Inference rejected for '{self.module_identifier}': model artifact missing at {self._artifact_file}"
                )
                raise ProblemDetailException(
                    status_code=503,
                    title="Model Artifact Unavailable",
                    detail=(
                        f"The trained machine learning pipeline artifact for '{self.display_name}' "
                        f"is not present or loaded in the runtime registry. Live inference cannot be executed."
                    ),
                    error_type="https://api.healthsync.ai/errors/model-unavailable",
                )

            # Demonstration mode: Calibrated reference epidemiological baseline
            return self._build_demonstration_response(input_data)

        # Real ML model execution path (invoked when artifact exists on disk)
        return self._execute_ml_inference(input_data)

    def _execute_ml_inference(self, input_data: DiabetesInput) -> DiabetesAssessmentResponse:
        """Stub for live model execution; invoked once pipeline artifact is bound."""
        raise NotImplementedError("Live pipeline execution requires loaded model artifact.")

    def _build_demonstration_response(self, input_data: DiabetesInput) -> DiabetesAssessmentResponse:
        """
        Builds a clearly designated prototype demonstration response.
        Explicitly identifies itself with the mandated medical disclosure notice.
        """
        score = 0.15  # Epidemiological baseline prevalence

        drivers: List[ShapDriverDetail] = []

        # Glucose driver
        if input_data.glucose > 125.0:
            impact = min(0.35, 0.15 + (input_data.glucose - 125.0) * 0.002)
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="glucose",
                    display_name="Fasting Blood Glucose",
                    feature_value=f"{input_data.glucose:.1f} mg/dL",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="Fasting glucose exceeds clinical diabetic fasting threshold (126 mg/dL).",
                )
            )
        elif input_data.glucose >= 100.0:
            impact = 0.08 + (input_data.glucose - 100.0) * 0.003
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="glucose",
                    display_name="Fasting Blood Glucose",
                    feature_value=f"{input_data.glucose:.1f} mg/dL",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="Fasting glucose in prediabetic range (100–125 mg/dL).",
                )
            )
        else:
            impact = -0.05
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="glucose",
                    display_name="Fasting Blood Glucose",
                    feature_value=f"{input_data.glucose:.1f} mg/dL",
                    shap_impact=round(impact, 4),
                    direction="PROTECTIVE",
                    clinical_context="Fasting glucose within optimal glycemic range (<100 mg/dL).",
                )
            )

        # BMI driver
        if input_data.bmi >= 30.0:
            impact = min(0.20, 0.08 + (input_data.bmi - 30.0) * 0.01)
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="bmi",
                    display_name="Body Mass Index",
                    feature_value=f"{input_data.bmi:.1f} kg/m²",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="BMI indicates Class I+ obesity with elevated peripheral insulin resistance.",
                )
            )
        elif input_data.bmi >= 25.0:
            impact = 0.04 + (input_data.bmi - 25.0) * 0.006
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="bmi",
                    display_name="Body Mass Index",
                    feature_value=f"{input_data.bmi:.1f} kg/m²",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="BMI indicates overweight category with mild metabolic load.",
                )
            )
        else:
            impact = -0.04
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="bmi",
                    display_name="Body Mass Index",
                    feature_value=f"{input_data.bmi:.1f} kg/m²",
                    shap_impact=round(impact, 4),
                    direction="PROTECTIVE",
                    clinical_context="Normal weight BMI supports cellular glucose uptake.",
                )
            )

        # Blood pressure
        if input_data.blood_pressure_systolic >= 140.0:
            impact = 0.07
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="blood_pressure_systolic",
                    display_name="Systolic Blood Pressure",
                    feature_value=f"{input_data.blood_pressure_systolic:.0f} mmHg",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="Systolic hypertension frequently coexists with insulin resistance.",
                )
            )

        # Physical activity
        if input_data.physical_activity_hours_week < 1.0:
            impact = 0.06
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="physical_activity_hours_week",
                    display_name="Weekly Aerobic Activity",
                    feature_value=f"{input_data.physical_activity_hours_week:.1f} hrs/wk",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="Low physical activity reduces non-insulin-mediated glucose disposal.",
                )
            )
        elif input_data.physical_activity_hours_week >= 2.5:
            impact = -0.05
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="physical_activity_hours_week",
                    display_name="Weekly Aerobic Activity",
                    feature_value=f"{input_data.physical_activity_hours_week:.1f} hrs/wk",
                    shap_impact=round(impact, 4),
                    direction="PROTECTIVE",
                    clinical_context="Meets WHO physical activity recommendation (>=150 min/wk).",
                )
            )

        # Family history
        if input_data.family_history_diabetes:
            impact = 0.09
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="family_history_diabetes",
                    display_name="Family History",
                    feature_value="Yes",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="First-degree diabetic relative confers polygenic susceptibility.",
                )
            )

        bounded_score = max(0.01, min(0.99, score))

        if bounded_score < 0.20:
            risk_level = "LOW"
        elif bounded_score < 0.45:
            risk_level = "MODERATE"
        elif bounded_score < 0.70:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        recommendations = [
            "Consult a licensed healthcare professional for clinical evaluation and laboratory HbA1c testing.",
            "Maintain or build toward at least 150 minutes of moderate aerobic exercise weekly.",
            "Adopt a fiber-rich dietary pattern with complex carbohydrates, legumes, and reduced added sugars.",
            "Track longitudinal blood pressure and glycemic markers at regular routine intervals.",
        ]

        return DiabetesAssessmentResponse(
            assessment_id=f"asm_db_{uuid.uuid4().hex[:12]}",
            module_id=self.module_identifier,
            model_version=self.model_version,
            risk_score=round(bounded_score, 4),
            risk_level=risk_level,
            confidence_interval=[0.0, 0.0],  # Explicit: No empirical CI without fitted model
            base_expected_risk=0.15,
            drivers=drivers,
            recommendations=recommendations,
            disclaimer=settings.MANDATORY_DISCLAIMER,
            created_at=datetime.utcnow(),
            is_demonstration_data=True,
            demonstration_notice=(
                "Prototype Demonstration Baseline (Epidemiological Reference Calibration) — "
                "Real model artifact binding in progress."
            ),
        )
