"""
HealthSync AI — FastAPI Backend Application Entry Point

Official Title: AI-Enabled Smart Health Monitoring System
Mandatory Clinical Notice: Informational risk estimation only. Not a medical diagnosis.
"""

from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncGenerator
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import logger
from app.engines.registry import RiskEngineRegistry
from app.schemas.common import HealthCheckResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifecycle management.
    Performs initialization, catalog registration checks, and graceful shutdown logging.
    """
    logger.info(
        f"Starting {settings.APP_NAME} [v{settings.APP_VERSION}] in {settings.ENVIRONMENT.upper()} mode..."
    )
    logger.info(f"Allowed CORS origins: {settings.CORS_ORIGINS}")
    
    # Verify module discovery catalog initialization
    registered_modules = RiskEngineRegistry.list_modules()
    logger.info(
        f"Risk Engine Registry initialized with {len(registered_modules)} active module definitions: "
        f"{[m.module_id for m in registered_modules]}"
    )
    
    yield
    
    logger.info(f"Shutting down {settings.APP_NAME} gracefully. Cleanup complete.")


def create_application() -> FastAPI:
    """
    Application factory initializing FastAPI with OpenAPI metadata, CORS,
    centralized RFC 7807 exception handling, and versioned routing.
    """
    app = FastAPI(
        title="HealthSync AI — API Backend",
        description=(
            "### AI-Enabled Smart Health Monitoring System\n\n"
            "High-performance REST API backend powering non-diagnostic clinical risk estimations, "
            "explainable AI biomarker insights, and patient health trend monitoring.\n\n"
            "**Mandatory Clinical Boundary:** Informational risk estimation only. Not a medical diagnosis "
            "or clinical substitute. Always consult a licensed healthcare professional."
        ),
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # 1. Configure Cross-Origin Resource Sharing (CORS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["Content-Type", "Content-Disposition"],
    )

    # 2. Register Centralized RFC 7807 Problem Details Handlers
    register_exception_handlers(app)

    # 3. Mount Versioned API Routers
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    # 4. Root Service Liveness & Info Routes
    @app.get(
        "/health",
        response_model=HealthCheckResponse,
        status_code=status.HTTP_200_OK,
        tags=["Health"],
        summary="Root Service Health Probe",
        description="Liveness probe for cloud orchestrators, load balancers, and monitoring agents.",
    )
    async def root_health() -> HealthCheckResponse:
        return HealthCheckResponse(
            status="healthy",
            timestamp=datetime.utcnow(),
            app_name=settings.APP_NAME,
            version=settings.APP_VERSION,
            environment=settings.ENVIRONMENT,
        )

    @app.get(
        "/",
        status_code=status.HTTP_200_OK,
        tags=["Root"],
        summary="Service Index",
        description="Returns basic API metadata, documentation link, and mandatory clinical disclaimer.",
    )
    async def root_index() -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "name": settings.APP_NAME,
                "version": settings.APP_VERSION,
                "status": "online",
                "docs_url": "/docs",
                "api_v1": f"{settings.API_V1_PREFIX}",
                "disclaimer": settings.MANDATORY_DISCLAIMER,
            },
        )

    return app


app = create_application()
