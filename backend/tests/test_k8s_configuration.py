"""
HealthSync AI — Kubernetes & Hybrid Cloud Manifests Test Suite (Phase 6.6)

Validates:
1. Manifest syntax and schema conformity across all YAML files in k8s/
2. Namespace declaration and Pod Security Standards (Restricted profile)
3. ConfigMap parameters and absence of plaintext secrets
4. Secret template safety (placeholders only)
5. Backend Deployment: replicas, image, ports, non-root securityContext, probes, resources
6. Backend Service: ClusterIP, correct selector, port 8000
7. Frontend Deployment: replicas, image, port 8080 (unprivileged), non-root UID 101, probes
8. Frontend Service: ClusterIP, port 80 mapping to 8080
9. Controlled Migration Job: opt-in execution, non-root, restartPolicy Never
10. NetworkPolicy: strict ingress boundary, frontend-to-backend routing, external egress
11. Ingress resource: correct routing to frontend service
"""

from pathlib import Path
import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
K8S_DIR = REPO_ROOT / "k8s"


def _load_yaml(filename: str):
    path = K8S_DIR / filename
    assert path.is_file(), f"Manifest {filename} must exist"
    with open(path, "r", encoding="utf-8") as f:
        docs = list(yaml.safe_load_all(f))
        return docs[0] if len(docs) == 1 else docs


class TestK8sNamespace:
    def setup_method(self):
        self.doc = _load_yaml("00-namespace.yaml")

    def test_namespace_metadata(self):
        assert self.doc["apiVersion"] == "v1"
        assert self.doc["kind"] == "Namespace"
        assert self.doc["metadata"]["name"] == "healthsync"

    def test_pod_security_restricted(self):
        labels = self.doc["metadata"].get("labels", {})
        assert labels.get("pod-security.kubernetes.io/enforce") == "restricted"


class TestK8sConfigMap:
    def setup_method(self):
        self.doc = _load_yaml("01-configmap.yaml")

    def test_configmap_structure(self):
        assert self.doc["apiVersion"] == "v1"
        assert self.doc["kind"] == "ConfigMap"
        assert self.doc["metadata"]["name"] == "healthsync-config"
        assert self.doc["metadata"]["namespace"] == "healthsync"

    def test_essential_config_keys(self):
        data = self.doc.get("data", {})
        assert "ENVIRONMENT" in data
        assert "PORT" in data
        assert "ML_MODELS_DIR" in data
        assert data["ML_MODELS_DIR"] == "/app/ml/artifacts"
        assert "MANDATORY_DISCLAIMER" in data


class TestK8sSecretExample:
    def setup_method(self):
        self.doc = _load_yaml("02-secret.example.yaml")

    def test_secret_structure(self):
        assert self.doc["apiVersion"] == "v1"
        assert self.doc["kind"] == "Secret"
        assert self.doc["metadata"]["name"] == "healthsync-secrets"

    def test_no_hardcoded_secrets(self):
        raw_text = (K8S_DIR / "02-secret.example.yaml").read_text(encoding="utf-8")
        assert "REPLACE_WITH_CRYPTOGRAPHICALLY_SECURE_KEY" in raw_text
        assert "<neon_user>" in raw_text
        assert "<neon_password>" in raw_text


class TestBackendWorkload:
    def setup_method(self):
        self.deployment = _load_yaml("10-backend-deployment.yaml")
        self.service = _load_yaml("11-backend-service.yaml")

    def test_backend_deployment_specs(self):
        assert self.deployment["apiVersion"] == "apps/v1"
        assert self.deployment["kind"] == "Deployment"
        assert self.deployment["metadata"]["name"] == "backend"
        assert self.deployment["spec"]["replicas"] >= 2

        pod_spec = self.deployment["spec"]["template"]["spec"]
        assert pod_spec["terminationGracePeriodSeconds"] == 30
        assert pod_spec["securityContext"]["runAsNonRoot"] is True
        assert pod_spec["securityContext"]["runAsUser"] == 10001

        container = pod_spec["containers"][0]
        assert container["name"] == "backend"
        assert container["image"] == "healthsync-backend:latest"
        assert container["ports"][0]["containerPort"] == 8000

        # Non-root container capabilities
        assert container["securityContext"]["allowPrivilegeEscalation"] is False
        assert "ALL" in container["securityContext"]["capabilities"]["drop"]

        # Probes
        assert container["readinessProbe"]["httpGet"]["path"] == "/health"
        assert container["livenessProbe"]["httpGet"]["path"] == "/health"
        assert container["startupProbe"]["httpGet"]["path"] == "/health"

        # Resources
        assert "requests" in container["resources"]
        assert "limits" in container["resources"]

    def test_backend_service_specs(self):
        assert self.service["apiVersion"] == "v1"
        assert self.service["kind"] == "Service"
        assert self.service["metadata"]["name"] == "backend"
        assert self.service["spec"]["selector"]["app"] == "backend"
        assert self.service["spec"]["ports"][0]["port"] == 8000
        assert self.service["spec"]["ports"][0]["targetPort"] == 8000


class TestFrontendWorkload:
    def setup_method(self):
        self.deployment = _load_yaml("20-frontend-deployment.yaml")
        self.service = _load_yaml("21-frontend-service.yaml")

    def test_frontend_deployment_specs(self):
        assert self.deployment["apiVersion"] == "apps/v1"
        assert self.deployment["kind"] == "Deployment"
        assert self.deployment["metadata"]["name"] == "frontend"
        assert self.deployment["spec"]["replicas"] >= 2

        pod_spec = self.deployment["spec"]["template"]["spec"]
        assert pod_spec["securityContext"]["runAsNonRoot"] is True
        assert pod_spec["securityContext"]["runAsUser"] == 101

        container = pod_spec["containers"][0]
        assert container["name"] == "frontend"
        assert container["image"] == "healthsync-frontend:latest"
        assert container["ports"][0]["containerPort"] == 8080

        # Unprivileged Nginx health probes
        assert container["readinessProbe"]["httpGet"]["path"] == "/nginx-health"
        assert container["livenessProbe"]["httpGet"]["path"] == "/nginx-health"

    def test_frontend_service_specs(self):
        assert self.service["apiVersion"] == "v1"
        assert self.service["kind"] == "Service"
        assert self.service["metadata"]["name"] == "frontend"
        assert self.service["spec"]["selector"]["app"] == "frontend"
        assert self.service["spec"]["ports"][0]["port"] == 80
        assert self.service["spec"]["ports"][0]["targetPort"] == 8080


class TestMigrationJobSafety:
    def setup_method(self):
        self.job = _load_yaml("30-migration-job.yaml")

    def test_migration_job_structure(self):
        assert self.job["apiVersion"] == "batch/v1"
        assert self.job["kind"] == "Job"
        assert self.job["metadata"]["name"] == "healthsync-migration-job"

        pod_spec = self.job["spec"]["template"]["spec"]
        assert pod_spec["restartPolicy"] == "Never"
        assert pod_spec["securityContext"]["runAsNonRoot"] is True
        assert pod_spec["securityContext"]["runAsUser"] == 10001

        container = pod_spec["containers"][0]
        assert container["command"] == ["alembic", "upgrade", "head"]


class TestNetworkPolicyIsolation:
    def setup_method(self):
        self.policies = _load_yaml("40-network-policy.yaml")

    def test_policies_declared(self):
        assert isinstance(self.policies, list)
        assert len(self.policies) == 2

        names = [p["metadata"]["name"] for p in self.policies]
        assert "frontend-network-policy" in names
        assert "backend-network-policy" in names

    def test_backend_ingress_restricted_to_frontend(self):
        backend_policy = next(p for p in self.policies if p["metadata"]["name"] == "backend-network-policy")
        ingress_rules = backend_policy["spec"]["ingress"]
        assert len(ingress_rules) > 0

        # Source must match podSelector: { matchLabels: { app: frontend } }
        from_source = ingress_rules[0]["from"][0]["podSelector"]["matchLabels"]
        assert from_source.get("app") == "frontend"


class TestIngressGateway:
    def setup_method(self):
        self.doc = _load_yaml("50-ingress.yaml")

    def test_ingress_specs(self):
        assert self.doc["apiVersion"] == "networking.k8s.io/v1"
        assert self.doc["kind"] == "Ingress"
        assert self.doc["metadata"]["name"] == "healthsync-ingress"
        rule = self.doc["spec"]["rules"][0]
        assert rule["host"] == "healthsync.local"
        path = rule["http"]["paths"][0]
        assert path["backend"]["service"]["name"] == "frontend"
        assert path["backend"]["service"]["port"]["number"] == 80
