"""
HealthSync AI — Pytest Configuration & Test Fixtures
"""

import asyncio
from pathlib import Path
import pytest
try:
    from fastapi.testclient import TestClient
    from app.main import app as fastapi_app
    from app.core.database import engine, Base
    import app.models as _models  # Ensures all ORM models are registered in Base.metadata
except ImportError:
    TestClient = None
    fastapi_app = None
    engine = None
    Base = None
    _models = None

ISOLATED_STAGING_TEST_FILES = {
    "test_neon_rls_staging.py",
    "test_staging_url_normalization.py",
    "test_sql_parser.py",
    "test_staging_connection_hooks.py",
    "test_ml_dependencies.py",
    "test_calibration_api.py",
    "test_shap_compatibility.py",
    "test_diabetes_engine.py",
    "test_production_config.py",
    "test_heart_dataset.py",
    "test_heart_training.py",
    "test_heart_production.py",
    "test_heart_engine.py",
    "test_docker_configuration.py",
    "test_k8s_configuration.py",
    "test_cicd_configuration.py",
    "test_monitoring_docker_k8s.py",
}

# Session tracking flag: indicates whether development SQLite was initialized
sqlite_initialized: bool = False


def _get_item_filename(item) -> str:
    """Safely retrieves test filename across pytest versions (pytest 7/8/9+ path vs legacy fspath)."""
    item_path = getattr(item, "path", None) or getattr(item, "fspath", None)
    if item_path is not None:
        return Path(str(item_path)).name
    return ""


def should_skip_sqlite_init(collected_items) -> bool:
    """
    Returns True if every collected test belongs to an isolated staging or
    offline normalization test file, ensuring SQLite initialization is skipped.
    """
    if not collected_items:
        return False
    collected_files = {_get_item_filename(item) for item in collected_items}
    collected_files.discard("")
    return bool(collected_files and collected_files.issubset(ISOLATED_STAGING_TEST_FILES))


@pytest.fixture(scope="session", autouse=True)
def setup_test_db(request):
    """
    Initializes tables on the development SQLite engine before running test suite.
    Skips initialization immediately if the session consists solely of isolated
    staging integration tests or offline URL normalization tests.
    """
    global sqlite_initialized
    if engine is None or Base is None or should_skip_sqlite_init(request.session.items):
        sqlite_initialized = False
        return

    async def _init_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(_init_tables())
    sqlite_initialized = True


@pytest.fixture(scope="session")
def client():
    """Synchronous FastAPI TestClient fixture for endpoint integration testing."""
    if fastapi_app is None or TestClient is None:
        pytest.skip("FastAPI / TestClient dependencies not installed in this environment.")
    with TestClient(fastapi_app) as test_client:
        yield test_client

