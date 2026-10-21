# AGENTS.md — Repository Operational Directives & Agent Guidelines

> **Project:** HealthSync AI (AI-Enabled Smart Health Monitoring System)  
> **Target Audience:** AI Coding Assistants, Pair Programmers & Software Engineers  
> **Mandatory Compliance:** All directives in this document are binding across all development sessions.

---

## 1. Core Operating Principles

1. **Build Incrementally:** Never attempt monolithic, multi-file code replacements in a single step without testing and verifying intermediary components.
2. **Inspect Before Editing:** Always read existing file contents and examine directory structures before proposing or applying modifications.
3. **Preserve Documentation & Comments:** Maintain code comments, clinical annotations, and docstrings unless explicitly instructed to refactor them.
4. **Explain Major Decisions:** State the architectural rationale and trade-offs before implementing non-trivial features.
5. **Verify Before Completion:** Never mark a task or feature complete until tests pass, the service starts, or the output is verified.

---

## 2. Strict Healthcare & Clinical Non-Negotiables

### 2.1 Non-Diagnostic Medical Boundary
- **Never describe risk estimations as diagnoses:** All user-facing copy, API documentation, variable names, and report strings must use terms such as *risk estimation*, *statistical probability*, *biomarker indicator*, and *lifestyle risk score*.
- **Mandatory Disclaimers:** Every assessment response, UI results screen, and PDF report must clearly display:  
  `"Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional."`

### 2.2 Zero Fabricated Predictions or Accuracy Figures
- **Never hardcode fake or randomized predictions:** All risk scores and SHAP explainability values must be generated dynamically by executing real, calibrated machine learning pipelines in the backend.
- **Never invent accuracy or clinical metrics:** Do not write fabricated statistics such as `"Achieves 99.4% clinical diagnostic accuracy"`. Only report verifiable metrics computed from reproducible validation scripts and logged in `metrics.json`.

### 2.3 Strict Separation of Data Realms
1. **Research Datasets (`ml/data/`):** De-identified, public cohorts (e.g., CDC BRFSS, UCI) used exclusively for offline model training and baseline SHAP summaries.
2. **Demonstration & Synthetic Data (`tests/fixtures/`):** Programmatically generated fixtures used for unit and integration testing.
3. **Actual User Data (PostgreSQL Database):** Live application data protected by Row Level Security (RLS). Under no circumstances may real personal medical data be stored during development.

---

## 3. Security, Privacy & Secret Management

1. **No Credentials in Frontend:** The `frontend/` codebase must **never** contain database connection strings, Supabase service-role keys, private encryption keys, or JWT secret keys. The frontend only communicates with the FastAPI backend via `/api/v1` REST endpoints.
2. **Environment Isolation:** Secrets must reside strictly in `.env` files that are ignored by git. Never commit `.env`, `.pem`, or private keys.
3. **Ask Before Adding Paid Services:** Do not sign up for or configure billable cloud services (e.g., paid cloud tiers, SMS gateways) without explicit user authorization.
4. **Input Boundary Enforcement:** Always validate inputs using Pydantic v2 on the server and Zod on the client. Enforce biological range boundaries (e.g., Systolic BP: 60–250 mmHg).

---

## 4. Repository Topology & Technology Standards

```
HealthSync-AI/
├── docs/       # Architecture & technical documentation
├── frontend/   # React + TypeScript + Tailwind CSS (Vite)
├── backend/    # Python 3.11+ + FastAPI + Pydantic v2 + SQLAlchemy 2.0
├── ml/         # Scikit-learn + SHAP training pipelines & notebooks
└── AGENTS.md   # Operational directives
```

### 4.1 Backend Standards (Python + FastAPI)
- **Formatting & Style:** Adhere strictly to PEP 8, formatted with Black/Ruff.
- **Typing:** Use strict Python type annotations (`typing.Optional`, `typing.List`, `pydantic.BaseModel`).
- **Asynchronous Execution:** Use `async def` for I/O-bound endpoints (database queries, external streams) and sync execution or background threads for CPU-bound tasks (ML inference).
- **Error Handling:** Always return errors formatted according to RFC 7807 (Problem Details for HTTP APIs).

### 4.2 Frontend Standards (React + TypeScript + Tailwind CSS)
- **Language & Types:** Strict TypeScript (`noImplicitAny: true`). Define data types matching the backend OpenAPI schema.
- **Styling:** Use Tailwind CSS utility classes. Maintain a cohesive, clean medical aesthetic (teal, slate dark mode, crisp high-contrast cards).
- **State Management:** Use Zustand for global auth/session state and TanStack Query for server data fetching and caching.

### 4.3 Machine Learning Standards (Scikit-learn + SHAP)
- **Calibration:** All classification models must be calibrated using `CalibratedClassifierCV` (isotonic regression or Platt scaling).
- **Explainability:** Utilize `shap.TreeExplainer` paired with pre-computed background summaries to ensure sub-60ms inference latency.
- **Artifact Packaging:** Save pipelines using `joblib` accompanied by a versioned `metadata.json` describing feature schemas and computed evaluation metrics.

---

## 5. Development & Testing Commands

### Backend Environment (PowerShell on Windows)
```powershell
# Navigate to backend
cd backend

# Create & activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start local development server
uvicorn app.main:app --reload --port 8000

# Run Pytest suite
pytest tests/ -v --cov=app
```

### Frontend Environment
```powershell
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev

# Run Vitest suite
npm run test

# Run build check
npm run build
```

### ML Pipeline Environment
```powershell
# Navigate to ml directory
cd ml

# Train diabetes model & export artifacts
python pipelines/train_diabetes.py

# Train heart disease model & export artifacts
python pipelines/train_heart.py
```

---

## 6. Recommended Slash Commands

When guiding the user or collaborating on tasks, suggest appropriate slash commands:
- `/plan`: Recommend when starting a new major milestone or planning architectural extensions.
- `/goal`: Recommend for long-running, autonomous tasks (e.g., executing full pipeline retraining and test suites).
- `/grill-me`: Recommend when aligning on design choices, medical feature boundaries, or UI/UX mockups.
- `/learn`: Recommend when capturing established repository preferences, verified configurations, or custom workflows.
