"""
HealthSync AI — Abstract Base Risk Engine Interface
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List
from app.schemas.modules import BiomarkerFeatureSchema


class BaseRiskEngine(ABC):
    """
    Abstract strategy interface that all disease risk screening modules must implement.
    Guarantees plug-and-play modularity for future health modules (e.g., Hypertension, CKD).
    """

    @property
    @abstractmethod
    def module_identifier(self) -> str:
        """Unique machine-readable identifier (e.g. 'diabetes', 'heart_disease')."""
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable module title."""
        pass

    @property
    @abstractmethod
    def model_version(self) -> str:
        """Active semantic version of the serialized model artifact."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Clinical scope description."""
        pass

    @property
    @abstractmethod
    def benchmark_dataset(self) -> str:
        """Reference training cohort citation."""
        pass

    @property
    @abstractmethod
    def algorithm(self) -> str:
        """Underlying machine learning algorithm family."""
        pass

    @property
    @abstractmethod
    def calibration_method(self) -> str:
        """Calibration method applied (isotonic regression / Platt scaling)."""
        pass

    @abstractmethod
    def get_features_schema(self) -> List[BiomarkerFeatureSchema]:
        """Returns the complete list of required biomarker features and biological boundaries."""
        pass

    @abstractmethod
    def validate_inputs(self, raw_input: Dict[str, Any]) -> Dict[str, Any]:
        """Validates biological and lifestyle inputs against physiological constraints."""
        pass

    @abstractmethod
    def preprocess(self, validated_input: Dict[str, Any]) -> Any:
        """Transforms validated dictionary into model-ready tensor/numpy array."""
        pass

    @abstractmethod
    def predict(self, feature_array: Any) -> float:
        """Executes calibrated in-memory inference to produce empirical risk probability."""
        pass

    @abstractmethod
    def explain(self, feature_array: Any, top_k: int = 5) -> Dict[str, Any]:
        """Calculates SHAP values to explain individual prediction drivers."""
        pass
