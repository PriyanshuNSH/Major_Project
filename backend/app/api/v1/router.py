"""
HealthSync AI — API v1 Root Router
"""

from fastapi import APIRouter
from app.api.v1.endpoints import assessments, health, modules

api_v1_router = APIRouter()

# Register endpoint routers
api_v1_router.include_router(health.router)
api_v1_router.include_router(modules.router)
api_v1_router.include_router(assessments.router)
