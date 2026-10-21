# HealthSync AI — Development Roadmap & Milestone Plan

> **Official Project Title:** AI-Enabled Smart Health Monitoring System  
> **Product Name:** HealthSync AI  
> **Version:** 1.0.0  
> **Approach:** Incremental, Test-Driven, Architecture-First  
> **Current Status:** Phase 0 (Architecture & Documentation) Completed  

---

## 1. Phased Development Milestones (0 through 9)

```
+-----------------------------------------------------------------------------------+
|                         HealthSync AI Milestone Timeline                          |
|                                                                                   |
|  [Phase 0] Architecture & Documentation (COMPLETED)                               |
|      │                                                                            |
|      v                                                                            |
|  [Phase 1] Frontend Foundation & Responsive UI (React, Vite, Tailwind CSS)        |
|      │                                                                            |
|      v                                                                            |
|  [Phase 2] FastAPI Backend Foundation (Core API, Schemas, Error Envelopes)         |
|      │                                                                            |
|      v                                                                            |
|  [Phase 3] Database & Authentication (Supabase PostgreSQL, RLS, Argon2id, JWT)    |
|      │                                                                            |
|      v                                                                            |
|  [Phase 4] Diabetes ML Pipeline (Dataset Ingestion, Training & Preprocessing)     |
|      │                                                                            |
|      v                                                                            |
|  [Phase 5] Heart Disease ML Pipeline (Dataset Ingestion, Training & Preprocessing)|
|      │                                                                            |
|      v                                                                            |
|  [Phase 6] SHAP Explainability & Model Calibration (CalibratedClassifierCV, XAI)  |
|      │                                                                            |
|      v                                                                            |
|  [Phase 7] Complete Frontend-Backend-ML Integration (E2E Assessment & Gauges)     |
|      │                                                                            |
|      v                                                                            |
|  [Phase 8] History, Reports & Dashboard (PDF Generation, Trends, History Views)   |
|      │                                                                            |
|      v                                                                            |
|  [Phase 9] Security Testing & Deployment (Containerization, Hardening, Audit)     |
+-----------------------------------------------------------------------------------+
```

---

### Phase 0: Architecture & Documentation (Completed)
- **Objective:** Establish the comprehensive architectural blueprint, security baselines, database schemas, API contracts, ML standards, and repository operational directives prior to writing application code.
- **Deliverables:**
  - `docs/PROJECT_OVERVIEW.md` (Mission, scope, SaMD boundaries, capabilities)
  - `docs/ARCHITECTURE.md` (C4 diagrams, monorepo layout, extensible registry pattern)
  - `docs/DATABASE_DESIGN.md` (PostgreSQL DDL, Supabase evaluation, RLS policies, ERD)
  - `docs/API_DESIGN.md` (REST contracts, OpenAPI 3.1, RFC 7807 error formats)
  - `docs/ML_DESIGN.md` (Pipelines, calibration theory, SHAP explainability, dataset isolation)
  - `docs/SECURITY_AND_PRIVACY.md` (HIPAA/GDPR alignment, Argon2id, token rotation, CSP)
  - `docs/DEVELOPMENT_ROADMAP.md` (10-phase sequence, DoD, risk register)
  - `AGENTS.md` (Mandatory AI agent instructions, clinical safety rules, development commands)
- **Definition of Done (DoD):** All 8 documents authored, cross-verified for consistency, and formally approved by project lead.

---

### Phase 1: Frontend Foundation & Responsive UI
- **Objective:** Set up the client application infrastructure with modern tooling and construct the foundational user experience and responsive layout.
- **Deliverables:**
  - Vite + React 18+ + TypeScript project initialized in `frontend/`.
  - Tailwind CSS v3 design system configuration with tailored healthcare color palette (medical teal `#0d9488`, slate dark mode `#0f172a`, high-contrast risk badges).
  - Navigation shell: responsive sidebar, header, dark/light theme switch, session indicator.
  - Reusable UI component library (`components/common/`): Card, Button, Input, Modal, Badge, Tooltip, Alert banner with clinical disclaimer.
  - Biometric input forms with client-side boundary hints and Zod validation schemas for Diabetes and Heart Disease modules.
  - UI mock state representations for Risk Gauge meters, Radar profiles, and SHAP attribution bars.
- **Definition of Done (DoD):** Frontend builds with zero TypeScript errors (`npm run build`), runs smoothly via `npm run dev`, is fully responsive across mobile and desktop breakpoints, and displays interactive, client-validated assessment forms.

---

### Phase 2: FastAPI Backend Foundation
- **Objective:** Establish the Python backend runtime, core configuration management, structured logging, request validation layers, and modular engine architecture.
- **Deliverables:**
  - FastAPI application factory in `backend/app/main.py` with lifespan hooks.
  - Pydantic v2 `BaseSettings` (`app/core/config.py`) loading `.env` securely.
  - Standardized RFC 7807 problem detail exception handlers (`app/core/exceptions.py`).
  - Structured JSON logging with automated redaction of sensitive biomarkers and credentials.
  - CORS middleware, security headers, and SlowAPI rate limiting configuration.
  - Abstract `BaseRiskEngine` interface and `RiskEngineRegistry` factory (`app/engines/`).
  - Health check (`/health`) and Module Discovery (`GET /api/v1/modules`) endpoints.
- **Definition of Done (DoD):** Backend server boots via `uvicorn app.main:app`, `/health` returns `200 OK`, `/api/v1/modules` lists active module metadata, and invalid routes return standard RFC 7807 problem details.

---

### Phase 3: Database & Authentication
- **Objective:** Stand up the PostgreSQL database (Supabase), apply Alembic migrations, configure Row Level Security (RLS), and implement identity management.
- **Deliverables:**
  - SQLAlchemy 2.0 async database engine and session factory (`app/core/database.py`).
  - Declarative ORM models: `User`, `UserProfile`, `HealthModule`, `Assessment`, `AssessmentReport`, `AuditLog`.
  - Alembic migration scripts creating tables, indexes, and automated timestamp triggers.
  - Supabase PostgreSQL Row Level Security (RLS) policies enforcing multi-tenant isolation (`WHERE user_id = auth.uid()`).
  - Auth services (`app/core/security.py`): Argon2id password hashing, JWT generation (15-min access), and rotating refresh tokens in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
  - Endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
- **Definition of Done (DoD):** Migrations apply cleanly (`alembic upgrade head`); user registration and login issue valid JWTs; RLS blocks cross-tenant reads; integration tests verify database constraints.

---

### Phase 4: Diabetes ML Pipeline
- **Objective:** Build the offline data preprocessing, training, and artifact serialization pipeline for Type 2 Diabetes risk estimation.
- **Deliverables:**
  - Benchmark dataset curation in `ml/data/` (CDC BRFSS Diabetes Indicators / NIDDK Pima benchmark).
  - Reproducible training pipeline (`ml/pipelines/train_diabetes.py`):
    - Handling missing values with `SimpleImputer` / median imputation.
    - Outlier-resilient scaling using `RobustScaler`.
    - Stratified k-fold cross-validation.
    - Model exploration (`HistGradientBoostingClassifier`, `RandomForestClassifier`, `LogisticRegression`).
  - Model serialization to `backend/app/artifacts/diabetes/model.joblib`.
  - Generation of companion `metadata.json` documenting verified evaluation metrics (AUC-ROC, PR-AUC, Brier score), training timestamp, and feature schema.
- **Definition of Done (DoD):** Training pipeline executes end-to-end, passes sanity checks on test inputs, and outputs versioned artifacts with strictly verifiable metrics in `metadata.json` (zero fabricated figures).

---

### Phase 5: Heart Disease ML Pipeline
- **Objective:** Build the offline data preprocessing, training, and artifact serialization pipeline for Cardiovascular / Heart Disease risk estimation.
- **Deliverables:**
  - Benchmark dataset curation in `ml/data/` (UCI Cleveland, Statlog, Hungarian cohorts).
  - Reproducible training pipeline (`ml/pipelines/train_heart.py`):
    - Categorical feature encoding (`OneHotEncoder`).
    - Numerical standardization (`StandardScaler`).
    - Stratified k-fold cross-validation.
    - Model selection with decision trees and gradient boosting.
  - Model serialization to `backend/app/artifacts/heart/model.joblib`.
  - Companion `metadata.json` documenting feature schema, valid physiological ranges, and validation metrics.
- **Definition of Done (DoD):** Pipeline trains and exports clean `.joblib` model and `metadata.json`; verified offline metrics are logged; model runs deterministic predictions on test vectors.

---

### Phase 6: SHAP Explainability & Model Calibration
- **Objective:** Implement rigorous probability calibration across both trained models and integrate sub-60ms local SHAP explainability.
- **Deliverables:**
  - Apply `CalibratedClassifierCV` (isotonic regression / Platt scaling) to both Diabetes and Heart models so predictions reflect true empirical probabilities.
  - Evaluation of calibration quality: Brier Score, Expected Calibration Error (ECE), and reliability curves.
  - Pre-computation of 100-sample k-means background summaries (`background.joblib`) for sub-60ms `TreeExplainer` performance.
  - Serialization of updated calibrated models and background datasets to backend artifact directories.
  - Concrete engine implementations (`DiabetesRiskEngine`, `HeartRiskEngine`) with `explain()` methods translating raw Shapley values into top positive (risk drivers) and negative (protective factors).
- **Definition of Done (DoD):** Both engines produce calibrated probabilities in $[0.0, 1.0]$; `explain()` returns valid SHAP feature attributions within 60ms; unit tests verify calibration and explainability outputs.

---

### Phase 7: Complete Frontend-Backend-ML Integration
- **Objective:** Connect the React frontend with the FastAPI backend and in-memory ML engines to deliver an end-to-end risk assessment user journey.
- **Deliverables:**
  - Frontend API integration using Axios interceptors with automatic Bearer token injection and refresh token rotation.
  - Assessment execution endpoints: `POST /api/v1/assessments/diabetes/estimate` and `POST /api/v1/assessments/heart-disease/estimate`.
  - Connecting the frontend forms to live backend assessment endpoints.
  - Dynamic UI rendering of assessment results:
    - Animated Risk Gauge meter reflecting calibrated risk score.
    - Risk category badge (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`).
    - Interactive horizontal bar chart visualizing SHAP feature contributions (risk drivers vs. protective factors).
    - Contextual, evidence-based lifestyle recommendations and mandatory medical disclaimer.
  - Persistence of completed assessments in PostgreSQL under authenticated user tenancy.
- **Definition of Done (DoD):** A user can register, log in, submit physiological vitals, trigger live in-memory ML scoring and SHAP explanation, view interactive visual results, and see the record persisted in the database.

---

### Phase 8: History, Reports & Dashboard
- **Objective:** Implement longitudinal health tracking, historical assessment retrieval, dashboard trend analytics, and clinical PDF report generation.
- **Deliverables:**
  - Server-side PDF report generator using ReportLab with embedded medical disclaimers, biomarker tables, SHAP explanation charts, and SHA-256 digital integrity hash.
  - Endpoints: `POST /api/v1/assessments/{id}/report` and `GET /api/v1/assessments/{id}/report/download`.
  - History query endpoints with pagination, module filtering, and soft-delete support (`GET /api/v1/assessments`).
  - Aggregation engine for dashboard summary cards and time-series trends (`GET /api/v1/dashboard/summary`, `GET /api/v1/dashboard/trends`).
  - Frontend Dashboard view:
    - Recent assessments overview.
    - Interactive Recharts time-series trajectory graphs (risk scores & biomarker changes over 30/90/365 days).
    - Assessment history table with sorting and filtering.
    - One-click clinical PDF report download button.
- **Definition of Done (DoD):** Historical assessments display in a responsive table; trend graphs render historical biomarker trajectories; PDF reports generate and download cleanly with verified SHA-256 checksums.

---

### Phase 9: Security Testing, Containerization & Deployment
- **Objective:** Execute comprehensive automated test suites, validate security hardening, containerize all services, and verify modular extensibility.
- **Deliverables:**
  - Full Pytest test suite covering unit, integration, authentication, and RLS tenancy isolation tests (>80% coverage).
  - Vitest frontend component tests and end-to-end user path validation.
  - Security audit: Dependency vulnerability scan (`pip-audit`, `npm audit`), CSP and HSTS header checks, rate limiting tests.
  - Multi-stage `Dockerfile` configurations for frontend (Nginx) and backend (Python 3.11-slim).
  - Unified `docker-compose.yml` orchestrating Frontend, Backend, and PostgreSQL database.
  - **Extensibility Proof-of-Concept (POC):** Implement a third mock/experimental health engine (e.g., `HypertensionRiskEngine`) registered via `RiskEngineRegistry` without changing database schemas or core routing.
- **Definition of Done (DoD):** All tests pass; zero high/critical vulnerabilities; entire application boots with `docker compose up --build`; third health module registers and executes cleanly.

---

## 2. Updated Risk Register & Mitigation Strategy

| Risk ID | Category | Description | Severity | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R-01** | Clinical / Legal | Users misinterpreting probabilistic risk outputs as formal medical diagnoses. | High | Medium | Prominent clinical disclaimers on every UI screen, API payload, and generated PDF report; strict use of risk estimation terminology rather than diagnostic labels. |
| **R-02** | Machine Learning | Model overconfidence or probability distortion due to uncalibrated outputs. | High | Medium | Enforce `CalibratedClassifierCV` (isotonic regression); evaluate Brier score and Expected Calibration Error (ECE) during Phase 6. |
| **R-03** | Data Privacy | Accidental data leakage between multi-tenant users. | Critical | Low | Enforce PostgreSQL Row Level Security (RLS) at the storage engine level; dual-check `user_id` scoping in API routes. |
| **R-04** | Security | Secret leakage or exposure of database credentials in frontend bundles. | Critical | Low | Zero direct database connections from frontend; strict `.gitignore` rules; secret scanning in CI; pure REST API interaction. |
| **R-05** | Performance | Heavy SHAP calculations causing API latency spikes. | Medium | Medium | Use optimized `shap.TreeExplainer` with pre-computed 100-sample k-means background summaries to keep inference under 60ms. |
| **R-06** | Sequence / Dependency | Developing frontend UI before backend APIs might cause contract mismatch. | Medium | Medium | Mitigate by anchoring frontend forms strictly to pre-defined OpenAPI schemas documented in `docs/API_DESIGN.md`. |
| **R-07** | Scope Creep | Academic timeline overruns due to premature feature additions (wearables, i18n). | Medium | High | Strict milestone gating; adhere to core MVP sequence (Phases 0–9) before exploring future expansion horizons. |

---

## 3. Quality Gates & Non-Negotiables

1. **Zero Faked Predictions:** Under no circumstances will mock risk scores or simulated SHAP values be hardcoded in production paths.
2. **Zero Plaintext Credentials:** No secrets, database connection strings, or JWT private keys in git history or client bundles.
3. **Reproducibility:** All ML artifacts must be regenerable from raw data using versioned training scripts.
4. **Mandatory Disclaimers:** All assessment outputs must contain educational/informational risk disclaimers.
5. **Phase Gating:** Each phase must achieve its Definition of Done (DoD) before progressing to subsequent phases.
