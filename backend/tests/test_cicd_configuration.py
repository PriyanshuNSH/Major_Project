"""
HealthSync AI — CI/CD & Automated Deployment Test Suite (Phase 6.7)

Validates:
1. Workflow file existence and valid YAML syntax.
2. Continuous Integration (.github/workflows/ci.yml):
   - Least privilege permissions ('contents: read')
   - Concurrency controls and cancel-in-progress
   - Triggers: Push & PR on main and develop, path exclusions for docs/markdown
   - Backend CI: Python 3.11, dependency caching, isolated test SQLite DB (never Neon)
   - Frontend CI: Node 22, npm cache, npm ci, unit tests, and production build
   - Docker Build Validation: Multi-stage buildx validation with push disabled (push: false)
   - Kubernetes Manifest Validation: Static manifest audit job
   - Security Audit: Repository scan for leaked .env files and private keys
3. Continuous Deployment (.github/workflows/deploy.yml):
   - Triggers: Release published or manual workflow_dispatch
   - Least privilege permissions including GHCR package write
   - GHCR publication with commit-SHA and latest tagging
   - Gated Kubernetes deployment under 'production' environment
   - Gated execution: Verifies KUBE_CONFIG secret before executing kubectl
   - Database safety invariant: Deployment workflow must NEVER run alembic migrations
4. Controlled Database Migration (.github/workflows/database-migration.yml):
   - Dedicated workflow triggered solely via manual workflow_dispatch
   - Mandatory confirmation input ('confirm_action' == 'MIGRATE')
   - Gated under 'production' environment
   - Reads DATABASE_URL from secrets
5. Secret Hygiene:
   - Zero hardcoded plaintext passwords, keys, or credentials across all workflow files.
"""

from pathlib import Path
import re
import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"


def _load_workflow(filename: str) -> dict:
    """Helper to parse a YAML workflow file."""
    path = WORKFLOWS_DIR / filename
    assert path.is_file(), f"Workflow file {filename} must exist at {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict), f"Workflow {filename} must parse to a dictionary"
    return data


def _read_workflow_text(filename: str) -> str:
    """Helper to read raw workflow text for regex/string checks."""
    path = WORKFLOWS_DIR / filename
    assert path.is_file(), f"Workflow file {filename} must exist at {path}"
    return path.read_text(encoding="utf-8")


def _get_triggers(doc: dict) -> dict:
    """Safely extract triggers mapping accounting for YAML 1.1 boolean key 'on' (True)."""
    return doc.get("on") if "on" in doc else doc.get(True, {})


class TestContinuousIntegrationWorkflow:
    def setup_method(self):
        self.filename = "ci.yml"
        self.doc = _load_workflow(self.filename)
        self.text = _read_workflow_text(self.filename)

    def test_workflow_name_and_permissions(self):
        assert "Continuous Integration" in self.doc.get("name", "")
        # Least privilege root permissions
        assert self.doc.get("permissions") == {"contents": "read"}

    def test_concurrency_configuration(self):
        concurrency = self.doc.get("concurrency", {})
        assert "ci-" in concurrency.get("group", "")
        assert concurrency.get("cancel-in-progress") is True

    def test_triggers_and_path_filtering(self):
        triggers = _get_triggers(self.doc)
        # Must trigger on push and pull_request
        assert "push" in triggers
        assert "pull_request" in triggers
        assert "workflow_dispatch" in triggers

        # Branches must include main and develop
        push_branches = triggers["push"].get("branches", [])
        assert "main" in push_branches
        assert "develop" in push_branches

        pr_branches = triggers["pull_request"].get("branches", [])
        assert "main" in pr_branches
        assert "develop" in pr_branches

        # Must ignore doc paths
        for event in ("push", "pull_request"):
            ignored = triggers[event].get("paths-ignore", [])
            assert any("docs" in p or "*.md" in p for p in ignored)

    def test_backend_ci_job(self):
        jobs = self.doc.get("jobs", {})
        assert "backend-ci" in jobs
        backend_job = jobs["backend-ci"]
        assert backend_job.get("runs-on") == "ubuntu-latest"

        steps = backend_job.get("steps", [])
        step_names = [s.get("name", "") for s in steps]

        # Verification of Python setup & pip cache
        setup_python_steps = [s for s in steps if "setup-python" in s.get("uses", "")]
        assert len(setup_python_steps) >= 1
        with_cfg = setup_python_steps[0].get("with", {})
        assert with_cfg.get("python-version") == "3.11"
        assert with_cfg.get("cache") == "pip"

        # Verification of test execution step
        test_steps = [s for s in steps if "unit test" in s.get("name", "").lower() or "pytest" in s.get("run", "")]
        assert len(test_steps) >= 1
        test_step = test_steps[0]
        test_env = test_step.get("env", {})

        # Isolated SQLite database invariant
        assert "DATABASE_URL" in test_env
        assert "sqlite" in test_env["DATABASE_URL"]
        assert "neon" not in test_env["DATABASE_URL"].lower()
        assert "postgres" not in test_env["DATABASE_URL"].lower()

        # Check that core test suites are executed
        run_cmd = test_step.get("run", "")
        assert "test_health.py" in run_cmd
        assert "test_docker_configuration.py" in run_cmd
        assert "test_k8s_configuration.py" in run_cmd
        assert "test_cicd_configuration.py" in run_cmd

    def test_frontend_ci_job(self):
        jobs = self.doc.get("jobs", {})
        assert "frontend-ci" in jobs
        frontend_job = jobs["frontend-ci"]
        assert frontend_job.get("runs-on") == "ubuntu-latest"

        steps = frontend_job.get("steps", [])

        # Node setup & cache
        node_steps = [s for s in steps if "setup-node" in s.get("uses", "")]
        assert len(node_steps) >= 1
        with_cfg = node_steps[0].get("with", {})
        assert with_cfg.get("node-version") == 22 or with_cfg.get("node-version") == "22"
        assert with_cfg.get("cache") == "npm"

        # npm ci, test, build
        run_cmds = [s.get("run", "") for s in steps]
        assert any("npm ci" in cmd for cmd in run_cmds)
        assert any("npm test" in cmd for cmd in run_cmds)
        assert any("npm run build" in cmd for cmd in run_cmds)

    def test_docker_build_validation_job(self):
        jobs = self.doc.get("jobs", {})
        assert "docker-build-validation" in jobs
        docker_job = jobs["docker-build-validation"]
        assert "backend-ci" in docker_job.get("needs", [])
        assert "frontend-ci" in docker_job.get("needs", [])

        steps = docker_job.get("steps", [])
        build_steps = [s for s in steps if "build-push-action" in s.get("uses", "")]
        assert len(build_steps) >= 2  # Backend and frontend

        for step in build_steps:
            with_cfg = step.get("with", {})
            # Must NOT push during CI validation
            assert with_cfg.get("push") is False
            # Must reference commit sha in tags
            tags = str(with_cfg.get("tags", ""))
            assert "github.sha" in tags

    def test_k8s_manifest_validation_job(self):
        jobs = self.doc.get("jobs", {})
        assert "k8s-manifest-validation" in jobs
        k8s_job = jobs["k8s-manifest-validation"]
        steps = k8s_job.get("steps", [])
        run_cmds = [s.get("run", "") for s in steps]
        assert any("test_k8s_configuration.py" in cmd for cmd in run_cmds)

    def test_security_audit_job(self):
        jobs = self.doc.get("jobs", {})
        assert "security-audit" in jobs
        audit_job = jobs["security-audit"]
        steps = audit_job.get("steps", [])
        run_cmds = [s.get("run", "") for s in steps]
        assert any(".env" in cmd for cmd in run_cmds)
        assert any(".pem" in cmd or ".key" in cmd for cmd in run_cmds)


class TestContinuousDeploymentWorkflow:
    def setup_method(self):
        self.filename = "deploy.yml"
        self.doc = _load_workflow(self.filename)
        self.text = _read_workflow_text(self.filename)

    def test_workflow_name_and_permissions(self):
        assert "Continuous Deployment" in self.doc.get("name", "")
        perms = self.doc.get("permissions", {})
        assert perms.get("contents") == "read"
        assert perms.get("packages") == "write"
        assert perms.get("id-token") == "write"

    def test_triggers_restricted_to_releases_and_manual(self):
        triggers = _get_triggers(self.doc)
        assert "release" in triggers
        assert triggers["release"].get("types") == ["published"]
        assert "workflow_dispatch" in triggers

        # Must NEVER trigger automatically on pull_request
        assert "pull_request" not in triggers

    def test_ghcr_publication_job(self):
        jobs = self.doc.get("jobs", {})
        assert "publish-ghcr" in jobs
        job = jobs["publish-ghcr"]

        steps = job.get("steps", [])
        # GHCR login step
        login_steps = [s for s in steps if "login-action" in s.get("uses", "")]
        assert len(login_steps) >= 1
        with_cfg = login_steps[0].get("with", {})
        assert with_cfg.get("registry") == "ghcr.io"
        assert "GITHUB_TOKEN" in str(with_cfg.get("password", ""))

        # Build & Push steps for backend and frontend
        push_steps = [s for s in steps if "build-push-action" in s.get("uses", "")]
        assert len(push_steps) >= 2

        for step in push_steps:
            cfg = step.get("with", {})
            assert cfg.get("push") is True
            tags = str(cfg.get("tags", ""))
            assert "ghcr.io" in tags
            assert "healthsync-" in tags
            assert "github.sha" in tags or "steps.meta.outputs.tag" in tags

    def test_gated_kubernetes_deployment_job(self):
        jobs = self.doc.get("jobs", {})
        assert "deploy-kubernetes" in jobs
        job = jobs["deploy-kubernetes"]

        # Depends on image publication
        assert "publish-ghcr" in job.get("needs", [])

        # Environment protection
        env_cfg = job.get("environment", {})
        if isinstance(env_cfg, dict):
            assert env_cfg.get("name") == "production"
        else:
            assert env_cfg == "production"

        steps = job.get("steps", [])
        run_cmds = "\n".join(s.get("run", "") for s in steps)

        # Verifies presence of KUBE_CONFIG check
        assert "KUBE_CONFIG" in run_cmds
        # Uses kubectl set image in healthsync namespace
        assert "kubectl set image" in run_cmds
        assert "healthsync" in run_cmds

    def test_database_safety_invariant_in_cd(self):
        """Continuous Deployment workflow must NEVER automatically run database migrations."""
        assert "alembic upgrade" not in self.text
        assert "alembic" not in self.text


class TestControlledDatabaseMigrationWorkflow:
    def setup_method(self):
        self.filename = "database-migration.yml"
        self.doc = _load_workflow(self.filename)
        self.text = _read_workflow_text(self.filename)

    def test_trigger_strictly_workflow_dispatch(self):
        triggers = _get_triggers(self.doc)
        assert list(triggers.keys()) == ["workflow_dispatch"]

        inputs = triggers["workflow_dispatch"].get("inputs", {})
        assert "confirm_action" in inputs
        assert inputs["confirm_action"].get("required") is True
        assert inputs["confirm_action"].get("default") == ""
        assert "MIGRATE" in inputs["confirm_action"].get("description", "")

        assert "target_revision" in inputs
        assert inputs["target_revision"].get("default") == "head"

    def test_environment_and_safeguard_check(self):
        jobs = self.doc.get("jobs", {})
        assert "apply-migration" in jobs
        job = jobs["apply-migration"]

        # Protected under production environment
        env_cfg = job.get("environment", {})
        if isinstance(env_cfg, dict):
            assert env_cfg.get("name") == "production"
        else:
            assert env_cfg == "production"

        steps = job.get("steps", [])
        run_cmds = "\n".join(s.get("run", "") for s in steps)

        # Confirmation safeguard verification step
        assert "confirm_action" in run_cmds
        assert "MIGRATE" in run_cmds

        # Alembic command
        assert "alembic upgrade" in run_cmds
        assert "DATABASE_URL" in self.text


class TestSecretHygieneAcrossWorkflows:
    @pytest.mark.parametrize("filename", ["ci.yml", "deploy.yml", "database-migration.yml"])
    def test_no_hardcoded_credentials(self, filename: str):
        text = _read_workflow_text(filename)

        # No hardcoded passwords or API keys
        assert not re.search(r'password\s*:\s*["\'](?!.*\$\{\{)[^"\'\n]+["\']', text, re.IGNORECASE)
        # No hardcoded postgres/neon connection URLs
        assert not re.search(r'postgresql(\+[a-z]+)?://\w+:[^@]+@', text, re.IGNORECASE)
        # No private keys or bearer tokens
        assert "BEGIN PRIVATE KEY" not in text
        assert "BEGIN RSA PRIVATE KEY" not in text
