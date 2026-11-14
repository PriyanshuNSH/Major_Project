# HealthSync AI — Kubernetes & Hybrid Cloud Deployment Runbook

> **Target Namespace:** `healthsync`  
> **Workloads:** FastAPI Machine Learning Backend + React/TypeScript (Nginx) Frontend  
> **Database Model:** Hybrid Cloud — External Neon Serverless PostgreSQL with SSL  
> **Compliance Stance:** Non-Diagnostic Risk Estimation · Non-Root Least Privilege · Zero Hardcoded Secrets

---

## 1. Architecture Overview & Hybrid Traffic Flow

```
                      [ Client Browser / Clinician Portal ]
                                       │
                                       ▼ (Port 80 / 443)
                            ┌─────────────────────┐
                            │  Ingress Controller │ (healthsync.local)
                            └──────────┬──────────┘
                                       │
                                       ▼ (Port 80)
                         ┌───────────────────────────┐
                         │    Frontend Service       │ (ClusterIP)
                         └─────────────┬─────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Frontend Pods (2 Replicas, unprivileged nginx on port 8080) │
        │  - Serves static compiled React 19 bundle                   │
        │  - Enforces SPA fallback routing                            │
        │  - Reverse-proxies /api/ and /health to Backend Service     │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
                                       ▼ (Port 8000: http://backend:8000)
                         ┌───────────────────────────┐
                         │     Backend Service       │ (ClusterIP: 'backend')
                         └─────────────┬─────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Backend Pods (2 Replicas, Uvicorn on port 8000, UID 10001) │
        │  - Scikit-learn + SHAP ML Inference Pipelines               │
        │  - JWT Authentication, RBAC & Audit Logging                 │
        │  - Pure-Python Vector PDF Report Generator                  │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 │ Egress via Port 5432 (TLS)                │ Egress via Port 587 (TLS)
                 ▼                                           ▼
      [ External Neon Cloud ]                     [ SMTP Mail Server ]
   Serverless PostgreSQL 16                     Gmail / Cloud SMTP Gateway
   - Row-Level Security (RLS)                   - Password Reset Tokens
   - Tenant Isolation Protections               - Email Verification Links
```

---

## 2. Directory Structure

```text
k8s/
├── 00-namespace.yaml          # Dedicated 'healthsync' namespace with Restricted Pod Security Standards
├── 01-configmap.yaml          # Non-sensitive application configuration (CORS, URLs, ML model dir)
├── 02-secret.example.yaml     # Template for external Neon DATABASE_URL and cryptographic JWT keys
├── 10-backend-deployment.yaml # FastAPI backend (2 replicas, non-root UID 10001, health probes)
├── 11-backend-service.yaml    # Internal ClusterIP service exposing backend on port 8000
├── 20-frontend-deployment.yaml# React + Nginx frontend (2 replicas, unprivileged UID 101)
├── 21-frontend-service.yaml   # Internal ClusterIP service exposing frontend on port 80
├── 30-migration-job.yaml      # Opt-in, controlled Alembic database migration Job
├── 40-network-policy.yaml     # Tenant isolation, ingress restriction, and strict egress controls
├── 50-ingress.yaml            # Optional NGINX ingress resource for external domain routing
└── README.md                  # Operational and troubleshooting runbook
```

---

## 3. Prerequisites

To deploy HealthSync AI to a Kubernetes cluster, the following tools must be installed on the deployment workstation:
- **`kubectl`** (v1.28+)
- **Container Runtime / Engine:** Docker Desktop, Rancher Desktop, Podman, or a remote cloud cluster CLI (`gcloud`, `aws`, `az`).
- **Target Kubernetes Cluster:**
  - Local development: Minikube, Kind, or K3s.
  - Production cloud: Google Kubernetes Engine (GKE), Amazon EKS, or Azure AKS.

---

## 4. Step-by-Step Deployment Guide (PowerShell)

### Step 1: Build Docker Container Images
From the repository root directory (`C:\Users\priya.000\Desktop\HealthSync-AI`):
```powershell
# 1. Build Backend Image (bundles FastAPI + Scikit-learn + ML artifacts)
docker build -f backend/Dockerfile -t healthsync-backend:latest .

# 2. Build Frontend Image (compiles React bundle + Nginx unprivileged server)
docker build -t healthsync-frontend:latest frontend
```

### Step 2: Load Images into Local Cluster (If using Minikube or Kind)
```powershell
# For Minikube:
minikube image load healthsync-backend:latest
minikube image load healthsync-frontend:latest

# For Kind:
kind load docker-image healthsync-backend:latest
kind load docker-image healthsync-frontend:latest
```

### Step 3: Create the Dedicated Namespace
```powershell
kubectl apply -f k8s/00-namespace.yaml
```

### Step 4: Configure Kubernetes Secrets Safely
> [!IMPORTANT]
> Never commit real secrets to Git. Supply the external Neon PostgreSQL connection string and cryptographic JWT secret via command-line:

```powershell
# Inject production secrets directly from environment or secure prompt:
kubectl create secret generic healthsync-secrets -n healthsync `
  --from-literal=DATABASE_URL="postgresql+asyncpg://<neon_user>:<neon_password>@<neon_endpoint>.neon.tech/<dbname>?ssl=require" `
  --from-literal=JWT_SECRET_KEY="<cryptographic-secret-at-least-32-chars-long>" `
  --from-literal=SMTP_USERNAME="" `
  --from-literal=SMTP_PASSWORD="" `
  --from-literal=SMTP_FROM_EMAIL="noreply@healthsync.ai"
```

*Alternatively, copy `k8s/02-secret.example.yaml` to `k8s/02-secret.yaml` (which is git-ignored), update the values, and run:*
```powershell
kubectl apply -f k8s/02-secret.yaml
```

### Step 5: Apply ConfigMap, Deployments, and Services
```powershell
# Apply non-sensitive config
kubectl apply -f k8s/01-configmap.yaml

# Deploy Backend API & ML inference service
kubectl apply -f k8s/10-backend-deployment.yaml
kubectl apply -f k8s/11-backend-service.yaml

# Deploy Frontend Web service
kubectl apply -f k8s/20-frontend-deployment.yaml
kubectl apply -f k8s/21-frontend-service.yaml

# Apply Network Policies (Defense-in-depth isolation)
kubectl apply -f k8s/40-network-policy.yaml

# Optional: Apply Ingress (if Ingress Controller is installed)
kubectl apply -f k8s/50-ingress.yaml
```

---

## 5. Controlled Database Migration Execution

> [!WARNING]
> Normal application startup **never** runs database migrations. This protects your external Neon PostgreSQL database against unintended race conditions or schema disruption.

When an authorized schema change is required, trigger the dedicated migration Job manually:
```powershell
# 1. Trigger the one-off migration job
kubectl apply -f k8s/30-migration-job.yaml

# 2. Watch job status
kubectl get jobs -n healthsync -w

# 3. View migration logs
kubectl logs -n healthsync job/healthsync-migration-job

# 4. Clean up the finished job
kubectl delete job healthsync-migration-job -n healthsync
```

---

## 6. Accessing the Application Locally

To access the Kubernetes-hosted application locally without an ingress controller, use port-forwarding:

```powershell
# Port-forward the Frontend Service (Port 5173 maps to container port 8080)
kubectl port-forward -n healthsync svc/frontend 5173:80

# In another terminal, port-forward the Backend Service for direct API inspection:
kubectl port-forward -n healthsync svc/backend 8000:8000
```

Open your browser at:
- **Frontend Portal:** `http://localhost:5173`
- **Backend Health Check:** `http://127.0.0.1:8000/health`
- **Interactive OpenAPI Documentation:** `http://127.0.0.1:8000/docs`

---

## 7. Operational Troubleshooting & Diagnostics

### Inspect Pod Status & Events
```powershell
# View all pods in namespace
kubectl get pods -n healthsync -o wide

# Describe a specific pod to inspect events and probes
kubectl describe pod -n healthsync <pod-name>
```

### Inspect Container Logs
```powershell
# Backend real-time logs
kubectl logs -n healthsync -l app=backend --tail=100 -f

# Frontend Nginx access & error logs
kubectl logs -n healthsync -l app=frontend --tail=100 -f
```

### Rolling Updates & Zero-Downtime Rollbacks
```powershell
# Inspect rollout status
kubectl rollout status deployment/backend -n healthsync
kubectl rollout status deployment/frontend -n healthsync

# View rollout history
kubectl rollout history deployment/backend -n healthsync

# Roll back to the previous deployment revision
kubectl rollout undo deployment/backend -n healthsync
```

### Teardown (Cluster Workloads Only)
To remove Kubernetes workloads without touching your external Neon database or local files:
```powershell
# Delete the entire healthsync namespace and its workloads
kubectl delete namespace healthsync
```
