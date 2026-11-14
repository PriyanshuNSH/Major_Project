"""
HealthSync AI — Docker & Containerization Assets Automated Test Suite (Phase 6.5)

Verifies:
1. Dockerfile syntactical structure and multi-stage compliance (backend & frontend)
2. Production non-root user enforcement
3. Pinned reproducible base images
4. Docker Compose service topology, networking, dependencies, and health checks
5. Database safety: Migration service under isolated profile, ordinary startup without auto-migration
6. Nginx configuration: SPA fallback, security headers, and API proxy routing
7. Docker ignore rules preventing secret leakage
"""

from pathlib import Path
import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]


class TestBackendDockerfile:
    def setup_method(self):
        self.dockerfile_path = REPO_ROOT / "backend" / "Dockerfile"
        assert self.dockerfile_path.is_file(), "backend/Dockerfile must exist"
        self.content = self.dockerfile_path.read_text(encoding="utf-8")

    def test_pinned_python_base_images(self):
        assert "FROM python:3.11.11-slim-bookworm AS builder" in self.content
        assert "FROM python:3.11.11-slim-bookworm AS runner" in self.content

    def test_multi_stage_build_structure(self):
        assert "AS builder" in self.content
        assert "AS runner" in self.content
        assert "COPY --from=builder /opt/venv /opt/venv" in self.content

    def test_non_root_user_enforcement(self):
        assert "groupadd -g 10001 healthsync" in self.content
        assert "useradd -u 10001 -g healthsync" in self.content
        assert "USER healthsync" in self.content

    def test_port_exposure_and_startup_command(self):
        assert "EXPOSE 8000" in self.content
        assert 'CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]' in self.content

    def test_container_healthcheck(self):
        assert "HEALTHCHECK" in self.content
        assert "http://localhost:8000/health" in self.content

    def test_ml_artifacts_inclusion(self):
        assert "COPY --chown=healthsync:healthsync ml/artifacts /app/ml/artifacts" in self.content
        assert "ENV" in self.content and "ML_MODELS_DIR=/app/ml/artifacts" in self.content


class TestFrontendDockerfile:
    def setup_method(self):
        self.dockerfile_path = REPO_ROOT / "frontend" / "Dockerfile"
        assert self.dockerfile_path.is_file(), "frontend/Dockerfile must exist"
        self.content = self.dockerfile_path.read_text(encoding="utf-8")

    def test_pinned_node_and_nginx_images(self):
        assert "FROM node:22-alpine AS builder" in self.content
        assert "FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner" in self.content

    def test_multi_stage_build(self):
        assert "npm ci" in self.content
        assert "npm run build" in self.content
        assert "COPY --from=builder" in self.content
        assert "/app/dist /usr/share/nginx/html" in self.content

    def test_unprivileged_execution_and_healthcheck(self):
        assert "EXPOSE 8080" in self.content
        assert "HEALTHCHECK" in self.content
        assert "http://localhost:8080/nginx-health" in self.content


class TestNginxConfiguration:
    def setup_method(self):
        self.conf_path = REPO_ROOT / "frontend" / "nginx.conf"
        assert self.conf_path.is_file(), "frontend/nginx.conf must exist"
        self.content = self.conf_path.read_text(encoding="utf-8")

    def test_unprivileged_port_listening(self):
        assert "listen 8080;" in self.content

    def test_spa_fallback_routing(self):
        assert "try_files $uri $uri/ /index.html;" in self.content

    def test_api_reverse_proxy_routing(self):
        assert "location /api/ {" in self.content
        assert "proxy_pass http://backend:8000/api/;" in self.content
        assert "proxy_set_header Host $host;" in self.content

    def test_health_reverse_proxy(self):
        assert "location = /nginx-health {" in self.content
        assert "location = /health" in self.content or "location /health {" in self.content

    def test_security_headers(self):
        assert 'add_header X-Content-Type-Options "nosniff"' in self.content
        assert 'add_header X-Frame-Options "DENY"' in self.content
        assert 'add_header X-XSS-Protection "1; mode=block"' in self.content


class TestDockerComposeArchitecture:
    def setup_method(self):
        self.compose_path = REPO_ROOT / "docker-compose.yml"
        assert self.compose_path.is_file(), "docker-compose.yml must exist"
        with open(self.compose_path, "r", encoding="utf-8") as f:
            self.data = yaml.safe_load(f)

    def test_required_services_declared(self):
        services = self.data.get("services", {})
        assert "backend" in services
        assert "frontend" in services
        assert "migration" in services
        assert "db" in services

    def test_frontend_depends_on_backend_healthy(self):
        frontend = self.data["services"]["frontend"]
        depends = frontend.get("depends_on", {})
        assert "backend" in depends
        assert depends["backend"]["condition"] == "service_healthy"

    def test_database_safety_migration_isolation(self):
        migration = self.data["services"]["migration"]
        profiles = migration.get("profiles", [])
        assert "migration" in profiles or "tools" in profiles, (
            "Migration service must be protected behind an explicit profile so it NEVER runs during normal startup"
        )
        assert migration.get("command") == ["alembic", "upgrade", "head"]

    def test_database_safety_local_db_isolation(self):
        db = self.data["services"]["db"]
        profiles = db.get("profiles", [])
        assert "local-db" in profiles, "Local PostgreSQL service must be behind local-db profile"

    def test_service_healthchecks_configured(self):
        backend = self.data["services"]["backend"]
        assert "healthcheck" in backend
        assert "http://localhost:8000/health" in " ".join(backend["healthcheck"]["test"])

        frontend = self.data["services"]["frontend"]
        assert "healthcheck" in frontend
        assert "http://localhost:8080/nginx-health" in " ".join(frontend["healthcheck"]["test"])

    def test_network_and_storage_declarations(self):
        assert "networks" in self.data
        assert "healthsync-network" in self.data["networks"]
        assert "volumes" in self.data
        assert "backend-data" in self.data["volumes"]


class TestDockerIgnoreSecurity:
    def setup_method(self):
        self.root_ignore = REPO_ROOT / ".dockerignore"
        assert self.root_ignore.is_file(), "Root .dockerignore must exist"
        self.content = self.root_ignore.read_text(encoding="utf-8")

    def test_sensitive_credentials_excluded(self):
        assert ".env" in self.content
        assert "*.pem" in self.content or "*.key" in self.content

    def test_virtualenvs_and_node_modules_excluded(self):
        assert "node_modules/" in self.content
        assert "venv/" in self.content

    def test_local_sqlite_databases_excluded(self):
        assert "**/*.db" in self.content or "*.db" in self.content
        assert "backend/healthsync_dev.db" in self.content
        assert "backend/healthsync_e2e.db" in self.content
