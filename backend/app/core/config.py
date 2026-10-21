"""
HealthSync AI — Application Settings and Environment Configuration
"""

from functools import lru_cache
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application Metadata
    APP_NAME: str = "HealthSync AI Backend"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Server Bindings
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # CORS Allowlist
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Machine Learning Model Artifacts
    ML_MODELS_DIR: str = ""

    # Structured Logging
    LOG_LEVEL: str = "INFO"

    # API Prefix
    API_V1_PREFIX: str = "/api/v1"

    # Clinical & Medical Policy
    MANDATORY_DISCLAIMER: str = (
        "Informational risk estimation only. Not a medical diagnosis or clinical substitute. "
        "Consult a healthcare professional."
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["http://localhost:5173", "http://127.0.0.1:5173"]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
