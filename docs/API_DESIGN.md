# HealthSync AI — REST API Design & Contracts

> **Official Project Title:** AI-Enabled Smart Health Monitoring System  
> **Product Name:** HealthSync AI  
> **Version:** 1.0.0  
> **Protocol:** RESTful HTTPS / JSON  
> **Schema Standard:** OpenAPI 3.1 & RFC 7807 (Problem Details)  
> **Base URL:** `/api/v1`  

---

## 1. Authentication, Sessions & Security Protocol

### 1.1 Dual-Token Architecture
HealthSync AI implements a secure stateless JWT authentication scheme:
- **Access Token:** Short-lived (15 minutes lifespan), signed via HMAC-SHA256 (`HS256`) or `RS256`. Transmitted in HTTP `Authorization: Bearer <access_token>` header. Contains standard claims: `sub` (User UUID), `role`, `email`, and `exp`.
- **Refresh Token:** Long-lived (7 days lifespan), stored in a cryptographically random, encrypted server-side store or JWT with rotating JTI (JWT ID). Transmitted strictly via an `HttpOnly`, `Secure`, `SameSite=Strict` cookie to prevent JavaScript access and Cross-Site Scripting (XSS) exfiltration.

### 1.2 Rate Limiting (SlowAPI / Token Bucket)
To protect backend inference engines against denial-of-service and brute-force enumeration:
- **Auth endpoints (`/auth/login`, `/auth/register`):** 5 requests / minute per IP.
- **ML Assessment endpoints (`/assessments/*/estimate`):** 20 requests / minute per authenticated user.
- **Report generation (`/assessments/*/report`):** 10 requests / minute per user.
- **General read endpoints:** 100 requests / minute per user.

---

## 2. Standardized Response Envelope & Error Handling

### 2.1 Success Response Wrapper
All non-binary successful responses conform to a predictable envelope:
```json
{
  "success": true,
  "timestamp": "2026-10-01T22:55:00.000Z",
  "data": { ... }
}
```

### 2.2 Error Format (RFC 7807 Problem Details)
All error responses return `Content-Type: application/problem+json`:
```json
{
  "type": "https://api.healthsync.ai/errors/validation-failed",
  "title": "Biomarker Validation Error",
  "status": 422,
  "detail": "Resting blood pressure value 320 mmHg exceeds maximum physiological threshold (260 mmHg).",
  "instance": "/api/v1/assessments/heart-disease/estimate",
  "invalid_params": [
    {
      "name": "resting_bp",
      "reason": "Value must be between 60 and 260 mmHg"
    }
  ]
}
```

---

## 3. Endpoints Catalog

### 3.1 Authentication & Session Management (`/api/v1/auth`)

| Method | Endpoint | Description | Access Level |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Creates a new user account and initializes default profile | Public |
| `POST` | `/auth/login` | Authenticates credentials; returns Access Token and sets Refresh Cookie | Public |
| `POST` | `/auth/refresh` | Validates refresh token cookie and issues new Access Token | Public (Cookie) |
| `POST` | `/auth/logout` | Revokes refresh token and clears session cookie | Authenticated |
| `GET` | `/auth/me` | Retrieves current authenticated identity & role | Authenticated |

#### Request/Response Example: User Registration
```json
// POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "full_name": "Jane Doe",
  "date_of_birth": "1990-05-15",
  "gender": "FEMALE"
}

// Response 201 Created
{
  "success": true,
  "timestamp": "2026-10-01T22:55:00.000Z",
  "data": {
    "user_id": "8f8b8e0a-5b12-4c6e-927b-2e9b891d4a01",
    "email": "user@example.com",
    "full_name": "Jane Doe",
    "role": "patient",
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in": 900
  }
}
```

---

### 3.2 Health Module Catalog (`/api/v1/modules`)

| Method | Endpoint | Description | Access Level |
| :--- | :--- | :--- | :--- |
| `GET` | `/modules` | Lists all active risk estimation modules, required biomarkers, and validation boundaries | Authenticated |
| `GET` | `/modules/{module_id}` | Detailed metadata, model version, and clinical references for a specific module | Authenticated |

#### Response Example: Active Modules
```json
// GET /api/v1/modules
{
  "success": true,
  "timestamp": "2026-10-01T22:55:00.000Z",
  "data": [
    {
      "module_id": "diabetes",
      "display_name": "Type 2 Diabetes Risk Estimator",
      "version": "v1.0.0",
      "features": [
        {"name": "glucose", "type": "number", "unit": "mg/dL", "min": 40, "max": 400, "required": true},
        {"name": "bmi", "type": "number", "unit": "kg/m2", "min": 10.0, "max": 65.0, "required": true},
        {"name": "blood_pressure_systolic", "type": "number", "unit": "mmHg", "min": 60, "max": 250, "required": true},
        {"name": "age", "type": "integer", "unit": "years", "min": 18, "max": 120, "required": true}
      ]
    },
    {
      "module_id": "heart_disease",
      "display_name": "Cardiovascular Risk Estimator",
      "version": "v1.0.0",
      "features": [
        {"name": "age", "type": "integer", "unit": "years", "min": 18, "max": 120, "required": true},
        {"name": "sex", "type": "integer", "options": [0, 1], "required": true},
        {"name": "chest_pain_type", "type": "integer", "options": [0, 1, 2, 3], "required": true},
        {"name": "resting_bp", "type": "number", "unit": "mmHg", "min": 60, "max": 260, "required": true},
        {"name": "serum_cholesterol", "type": "number", "unit": "mg/dL", "min": 100, "max": 600, "required": true}
      ]
    }
  ]
}
```

---

### 3.3 Health Risk Assessment & Local Inference (`/api/v1/assessments`)

| Method | Endpoint | Description | Access Level |
| :--- | :--- | :--- | :--- |
| `POST` | `/assessments/diabetes/estimate` | Runs local diabetes inference + SHAP explainability; persists result | Patient / Clinician |
| `POST` | `/assessments/heart-disease/estimate` | Runs local heart disease inference + SHAP explainability; persists result | Patient / Clinician |
| `GET` | `/assessments` | Retrieves paginated user assessment history with module and date filters | Patient / Clinician |
| `GET` | `/assessments/{assessment_id}` | Retrieves full assessment details, biomarker vector, and complete SHAP waterfall data | Patient / Clinician |
| `DELETE` | `/assessments/{assessment_id}` | Soft-deletes a specific assessment record | Patient / Clinician |

#### Request & Response: Diabetes Risk Estimation
```json
// POST /api/v1/assessments/diabetes/estimate
{
  "glucose": 142.0,
  "blood_pressure_systolic": 138.0,
  "blood_pressure_diastolic": 88.0,
  "bmi": 31.4,
  "age": 48,
  "insulin": 125.0,
  "skin_thickness": 28.0,
  "pregnancies": 2,
  "physical_activity_hours_week": 1.5,
  "family_history_diabetes": true
}

// Response 201 Created
{
  "success": true,
  "timestamp": "2026-10-01T22:55:00.000Z",
  "data": {
    "assessment_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "module_id": "diabetes",
    "model_version": "v1.0.0",
    "risk_score": 0.6420,
    "risk_level": "HIGH",
    "confidence_interval": [0.582, 0.702],
    "explanation": {
      "base_value": 0.3200,
      "risk_drivers": [
        {"feature": "glucose", "feature_value": 142.0, "shap_impact": +0.1850, "description": "Elevated fasting glucose strongly increases risk"},
        {"feature": "bmi", "feature_value": 31.4, "shap_impact": +0.0920, "description": "BMI in Class I obesity category increases insulin resistance"},
        {"feature": "blood_pressure_systolic", "feature_value": 138.0, "shap_impact": +0.0450, "description": "Stage 1 systolic hypertension"}
      ],
      "protective_factors": [
        {"feature": "physical_activity_hours_week", "feature_value": 1.5, "shap_impact": -0.0210, "description": "Active exercise reduces risk baseline"}
      ]
    },
    "actionable_recommendations": [
      "Consult a licensed physician for formal HbA1c screening.",
      "Engage in at least 150 minutes of moderate aerobic activity weekly.",
      "Incorporate complex, high-fiber carbohydrates and reduce simple refined sugars."
    ],
    "disclaimer": "Informational screening based on statistical modeling. Not a clinical diagnosis.",
    "created_at": "2026-10-01T22:55:00.000Z"
  }
}
```

---

### 3.4 Clinical PDF Reports (`/api/v1/assessments/{id}/report`)

| Method | Endpoint | Description | Access Level |
| :--- | :--- | :--- | :--- |
| `POST` | `/assessments/{id}/report` | Generates a tamper-evident clinical PDF summary report | Patient / Clinician |
| `GET` | `/assessments/{id}/report/download` | Streams the PDF file (`application/pdf`) with cryptographic checksum | Patient / Clinician |

---

### 3.5 Personal Health Dashboard & Trends (`/api/v1/dashboard`)

| Method | Endpoint | Description | Access Level |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard/summary` | Aggregated dashboard overview: latest risk scores, high-impact alerts, adherence | Authenticated |
| `GET` | `/dashboard/trends?module={type}&days={N}` | Historical biomarker and risk trajectory time-series for chart plotting | Authenticated |

#### Response Example: Dashboard Trends
```json
// GET /api/v1/dashboard/trends?module=diabetes&days=90
{
  "success": true,
  "timestamp": "2026-10-01T22:55:00.000Z",
  "data": {
    "module_id": "diabetes",
    "data_points": [
      {"date": "2026-07-01", "risk_score": 0.7200, "glucose": 155.0, "bmi": 32.1},
      {"date": "2026-08-15", "risk_score": 0.6800, "glucose": 148.0, "bmi": 31.8},
      {"date": "2026-10-01", "risk_score": 0.6420, "glucose": 142.0, "bmi": 31.4}
    ],
    "trend_direction": "IMPROVING",
    "delta_risk_score": -0.0780
  }
}
```

---

### 3.6 User Profile & Data Rights (`/api/v1/profile`)

| Method | Endpoint | Description | Access Level |
| :--- | :--- | :--- | :--- |
| `GET` | `/profile` | Retrieves physiological baseline and lifestyle profile | Authenticated |
| `PUT` | `/profile` | Updates physiological baseline parameters | Authenticated |
| `POST` | `/profile/export-data` | Generates comprehensive JSON archive of all personal records (GDPR Portability) | Authenticated |
| `DELETE` | `/profile/delete-account` | Initiates cascading soft-deletion and scheduled hard-purge (Right to be Forgotten) | Authenticated |
