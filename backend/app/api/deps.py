"""
HealthSync AI — FastAPI Dependency Injection Providers
"""

from typing import Annotated
from fastapi import Depends
from app.core.config import Settings, get_settings

# Type alias for injected settings
CurrentSettings = Annotated[Settings, Depends(get_settings)]
