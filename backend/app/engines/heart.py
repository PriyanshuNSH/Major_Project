"""
HealthSync AI — Cardiovascular / Heart Disease Risk Engine Implementation

Clinical Scope: Coronary artery disease risk estimation based on hemodynamics, lipids, and stress markers.
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
from app.schemas.diabetes import ShapDriverDetail
from app.schemas.heart import (
    HeartAssessmentResponse,
    HeartDiseaseInput,
)
from app.schemas.modules import BiomarkerFeatureSchema

settings = get_settings()


class HeartDiseaseRiskEngine(BaseRiskEngine):
    """
    Concrete risk engine for Cardiovascular Disease estimation.
    Strictly validates artifacts, raises 503 Problem Details when missing,
    and supports explicit demonstration mode with the required clinical notices.
    """

    def __init__(self, artifacts_dir: Optional[Path] = None):
        self._artifacts_dir = artifacts_dir or self._resolve_artifacts_dir()
        self._artifact_file = self._artifacts_dir / "heart_disease_pipeline.joblib"
        self._model = None
        self._explainer = None

    def _resolve_artifacts_dir(self) -> Path:
        if settings.ML_MODELS_DIR:
            return Path(settings.ML_MODELS_DIR)
        root_dir = Path(__file__).resolve().parent.parent.parent.parent
        return root_dir / "ml" / "artifacts"

    @property
    def module_identifier(self) -> str:
        return "heart_disease"

    @property
    def display_name(self) -> str:
        return "Cardiovascular Risk Estimator"

    @property
    def model_version(self) -> str:
        return "v1.0.0-foundation"

    @property
    def description(self) -> str:
        return (
            "Assesses coronary artery risk vulnerability based on resting ECG, "
            "serum lipids, hemodynamic parameters, and exercise stress indicators."
        )

    @property
    def benchmark_dataset(self) -> str:
        return "UCI Cleveland & Statlog Combined Cardiovascular Diagnostic Benchmark"

    @property
    def algorithm(self) -> str:
        return "RandomForestClassifier (Ensemble Decision Trees)"

    @property
    def calibration_method(self) -> str:
        return "CalibratedClassifierCV (Platt Scaling / Sigmoid)"

    def is_model_available(self) -> bool:
        return self._artifact_file.exists() and self._artifact_file.is_file()

    def get_features_schema(self) -> List[BiomarkerFeatureSchema]:
        return [
            BiomarkerFeatureSchema(
                name="age",
                display_name="Age",
                data_type="integer",
                unit="years",
                min_allowed=18.0,
                max_allowed=120.0,
                required=True,
                description="Patient chronological age",
            ),
            BiomarkerFeatureSchema(
                name="sex",
                display_name="Biological Sex",
                data_type="integer",
                options=[0, 1],
                required=True,
                description="Biological sex (1 = Male, 0 = Female)",
            ),
            BiomarkerFeatureSchema(
                name="chest_pain_type",
                display_name="Chest Pain Profile",
                data_type="integer",
                options=[0, 1, 2, 3],
                required=True,
                description="0: Typical Angina, 1: Atypical Angina, 2: Non-anginal, 3: Asymptomatic",
            ),
            BiomarkerFeatureSchema(
                name="resting_bp",
                display_name="Resting Blood Pressure",
                data_type="float",
                unit="mmHg",
                min_allowed=60.0,
                max_allowed=260.0,
                required=True,
                description="Resting systemic arterial blood pressure",
            ),
            BiomarkerFeatureSchema(
                name="serum_cholesterol",
                display_name="Serum Cholesterol",
                data_type="float",
                unit="mg/dL",
                min_allowed=100.0,
                max_allowed=600.0,
                required=True,
                description="Total serum cholesterol concentration",
            ),
            BiomarkerFeatureSchema(
                name="fasting_blood_sugar",
                display_name="Fasting Blood Sugar > 120",
                data_type="boolean",
                required=True,
                description="True if fasting blood glucose exceeds 120 mg/dL",
            ),
            BiomarkerFeatureSchema(
                name="resting_ecg",
                display_name="Resting ECG",
                data_type="integer",
                options=[0, 1, 2],
                required=True,
                description="0: Normal, 1: ST-T wave abnormality, 2: Left ventricular hypertrophy",
            ),
            BiomarkerFeatureSchema(
                name="max_heart_rate",
                display_name="Max Heart Rate Achieved",
                data_type="float",
                unit="bpm",
                min_allowed=60.0,
                max_allowed=220.0,
                required=True,
                description="Maximum heart rate reached during treadmill stress testing",
            ),
            BiomarkerFeatureSchema(
                name="exercise_angina",
                display_name="Exercise Induced Angina",
                data_type="boolean",
                required=True,
                description="Chest pain provoked during physical exercise",
            ),
            BiomarkerFeatureSchema(
                name="oldpeak",
                display_name="ST Depression (Oldpeak)",
                data_type="float",
                unit="mm",
                min_allowed=0.0,
                max_allowed=10.0,
                required=True,
                description="Exercise-induced ST depression relative to resting baseline",
            ),
            BiomarkerFeatureSchema(
                name="st_slope",
                display_name="ST Segment Slope",
                data_type="integer",
                options=[0, 1, 2],
                required=True,
                description="Slope of peak exercise ST segment (0: Upsloping, 1: Flat, 2: Downsloping)",
            ),
        ]

    def validate_inputs(self, raw_input: Dict[str, Any]) -> Dict[str, Any]:
        validated = HeartDiseaseInput.model_validate(raw_input)
        return validated.model_dump()

    def preprocess(self, validated_input: Dict[str, Any]) -> Any:
        return validated_input

    def predict(self, feature_array: Any) -> float:
        if not self.is_model_available():
            raise RuntimeError("Cannot predict: Model artifact not available.")
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

    def estimate(self, input_data: HeartDiseaseInput, allow_demo: bool = False) -> HeartAssessmentResponse:
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

            return self._build_demonstration_response(input_data)

        raise NotImplementedError("Live pipeline execution requires loaded model artifact.")

    def _build_demonstration_response(self, input_data: HeartDiseaseInput) -> HeartAssessmentResponse:
        score = 0.12
        drivers: List[ShapDriverDetail] = []

        # Age
        if input_data.age > 55:
            impact = 0.08 + (input_data.age - 55) * 0.003
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="age",
                    display_name="Age",
                    feature_value=f"{input_data.age} yrs",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="Age is an established cumulative risk factor for vascular remodeling.",
                )
            )

        # Chest Pain Type (0: Typical Angina, 1: Atypical, 2: Non-anginal, 3: Asymptomatic)
        chest_labels = {
            0: "Typical Angina",
            1: "Atypical Angina",
            2: "Non-anginal Pain",
            3: "Asymptomatic",
        }
        if input_data.chest_pain_type == 0:
            impact = 0.14
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="chest_pain_type",
                    display_name="Chest Pain Profile",
                    feature_value=chest_labels.get(input_data.chest_pain_type, "Unknown"),
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="Exertional substernal pressure strongly indicates potential myocardial ischemia.",
                )
            )
        elif input_data.chest_pain_type == 2:
            impact = -0.04
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="chest_pain_type",
                    display_name="Chest Pain Profile",
                    feature_value=chest_labels.get(input_data.chest_pain_type, "Unknown"),
                    shap_impact=round(impact, 4),
                    direction="PROTECTIVE",
                    clinical_context="Non-anginal discomfort has lower correlation with obstructive coronary disease.",
                )
            )

        # Serum Cholesterol
        if input_data.serum_cholesterol > 240.0:
            impact = min(0.25, 0.10 + (input_data.serum_cholesterol - 240.0) * 0.001)
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="serum_cholesterol",
                    display_name="Serum Cholesterol",
                    feature_value=f"{input_data.serum_cholesterol:.0f} mg/dL",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="Hypercholesterolemia drives atherogenic plaque deposition in coronary arteries.",
                )
            )
        elif input_data.serum_cholesterol < 200.0:
            impact = -0.05
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="serum_cholesterol",
                    display_name="Serum Cholesterol",
                    feature_value=f"{input_data.serum_cholesterol:.0f} mg/dL",
                    shap_impact=round(impact, 4),
                    direction="PROTECTIVE",
                    clinical_context="Desirable total cholesterol level under 200 mg/dL protects arterial intima.",
                )
            )

        # ST Depression (oldpeak)
        if input_data.oldpeak >= 2.0:
            impact = 0.15
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="oldpeak",
                    display_name="ST Depression (Oldpeak)",
                    feature_value=f"{input_data.oldpeak:.1f} mm",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="ST depression >= 2.0 mm reflects exertional subendocardial ischemia.",
                )
            )
        elif input_data.oldpeak == 0.0:
            impact = -0.04
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="oldpeak",
                    display_name="ST Depression (Oldpeak)",
                    feature_value="0.0 mm",
                    shap_impact=round(impact, 4),
                    direction="PROTECTIVE",
                    clinical_context="No exercise-induced ST segment depression detected.",
                )
            )

        # Exercise Angina
        if input_data.exercise_angina:
            impact = 0.11
            score += impact
            drivers.append(
                ShapDriverDetail(
                    feature="exercise_angina",
                    display_name="Exercise Induced Angina",
                    feature_value="Yes",
                    shap_impact=round(impact, 4),
                    direction="RISK_ELEVATING",
                    clinical_context="Exercise-provoked angina reflects demand-supply myocardial oxygen mismatch.",
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
            "Schedule an evaluation with a board-certified physician or cardiologist.",
            "Undergo a comprehensive 12-lead resting ECG and clinical lipid panel.",
            "Adhere strictly to target blood pressure guidelines (<120/80 mmHg).",
            "Follow heart-healthy nutritional patterns (e.g. Mediterranean or DASH diets).",
        ]

        return HeartAssessmentResponse(
            assessment_id=f"asm_ht_{uuid.uuid4().hex[:12]}",
            module_id=self.module_identifier,
            model_version=self.model_version,
            risk_score=round(bounded_score, 4),
            risk_level=risk_level,
            confidence_interval=[0.0, 0.0],  # Explicit: No empirical CI without fitted model
            base_expected_risk=0.12,
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
