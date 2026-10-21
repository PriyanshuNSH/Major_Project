"""
HealthSync AI — Risk Engine Registry & Metadata Factory
"""

from typing import Dict, List, Optional
from app.engines.base import BaseRiskEngine
from app.engines.diabetes import DiabetesRiskEngine
from app.engines.heart import HeartDiseaseRiskEngine
from app.schemas.common import EngineStatusResponse
from app.schemas.modules import BiomarkerFeatureSchema, HealthModuleDetail, HealthModuleSummary


class RiskEngineRegistry:
    """
    Central registry for clinical disease risk modules.
    Enables zero-touch plug-and-play addition of subsequent modules (e.g. Hypertension, CKD).
    """

    _engines: Dict[str, BaseRiskEngine] = {}

    @classmethod
    def register(cls, engine: BaseRiskEngine) -> None:
        cls._engines[engine.module_identifier] = engine

    @classmethod
    def get(cls, module_identifier: str) -> Optional[BaseRiskEngine]:
        cls._ensure_default_engines()
        normalized = module_identifier.lower().replace("-", "_")
        return cls._engines.get(normalized)

    @classmethod
    def _ensure_default_engines(cls) -> None:
        """Instantiates and registers default foundation engines if not already registered."""
        if "diabetes" not in cls._engines:
            cls.register(DiabetesRiskEngine())
        if "heart_disease" not in cls._engines:
            cls.register(HeartDiseaseRiskEngine())

    @classmethod
    def list_modules(cls) -> List[HealthModuleSummary]:
        cls._ensure_default_engines()
        summaries = []
        for engine in cls._engines.values():
            summaries.append(
                HealthModuleSummary(
                    module_id=engine.module_identifier,
                    display_name=engine.display_name,
                    model_version=engine.model_version,
                    description=engine.description,
                    features_count=len(engine.get_features_schema()),
                    is_active=True,
                )
            )
        return summaries

    @classmethod
    def get_statuses(cls) -> List[EngineStatusResponse]:
        cls._ensure_default_engines()
        statuses = []
        for engine in cls._engines.values():
            if hasattr(engine, "get_status"):
                statuses.append(engine.get_status())
        return statuses

    @classmethod
    def get_status(cls, module_identifier: str) -> Optional[EngineStatusResponse]:
        engine = cls.get(module_identifier)
        if engine and hasattr(engine, "get_status"):
            return engine.get_status()
        return None

    @classmethod
    def get_module_detail(cls, module_identifier: str) -> Optional[HealthModuleDetail]:
        cls._ensure_default_engines()
        engine = cls.get(module_identifier)
        if not engine:
            return None

        return HealthModuleDetail(
            module_id=engine.module_identifier,
            display_name=engine.display_name,
            model_version=engine.model_version,
            description=engine.description,
            features_count=len(engine.get_features_schema()),
            is_active=True,
            benchmark_dataset=engine.benchmark_dataset,
            algorithm=engine.algorithm,
            calibration_method=engine.calibration_method,
            disclaimer="Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.",
            features=engine.get_features_schema(),
        )
