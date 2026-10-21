# HealthSync AI — Security, Privacy & Compliance Architecture

> **Official Project Title:** AI-Enabled Smart Health Monitoring System  
> **Product Name:** HealthSync AI  
> **Version:** 1.0.0  
> **Classification:** Confidential / Healthcare Product Baseline  
> **Regulatory Alignment:** HIPAA Security Rule, GDPR (Art. 6 & 9), India DPDPA (2023)  

---

## 1. Healthcare Data Sensitivity & Governance Framework

HealthSync AI treats all biometric, physiological, and risk assessment records as **Special Category Data** (GDPR Article 9) and **Protected Health Information (PHI)**. The platform implements the principle of **Privacy by Design and by Default**:

```
+---------------------------------------------------------------------------------+
|                         Privacy by Design Core Pillars                          |
|                                                                                 |
|  1. DATA MINIMIZATION                                                           |
|     - Only collect biomarkers strictly required by active inference engines.    |
|     - Never request government identity IDs, physical addresses, or financial   |
|       data.                                                                     |
|                                                                                 |
|  2. PURPOSE LIMITATION                                                          |
|     - User biometric telemetry is utilized solely to compute personal risk      |
|       scores and display historical trends.                                     |
|     - Telemetry is NEVER sold, shared with third-party advertisers, or used     |
|       for unsupervised automated profiling.                                     |
|                                                                                 |
|  3. CRYPTOGRAPHIC DATA ISOLATION                                                |
|     - Multi-tenant data segregation enforced at the database kernel via         |
|       PostgreSQL Row Level Security (RLS).                                      |
+---------------------------------------------------------------------------------+
```

---

## 2. Authentication & Identity Management

### 2.1 Password Hashing Specification
User passwords must **never** be stored in plaintext or reversible encryption.
- **Algorithm:** **Argon2id** (winner of the Password Hashing Competition, memory-hard against GPU/ASIC attacks).
- **Cost Parameters:**
  - Memory Cost ($m$): $65536\text{ KiB}$ (64 MB)
  - Time Cost ($t$): $3$ iterations
  - Parallelism ($p$): $4$ threads
- **Fallback Standard:** Bcrypt with minimum work factor of 12 rounds.

### 2.2 JWT Token Lifecycle & Cryptographic Signing
- **Access Tokens:**
  - Standard claim set: `sub` (User UUID), `email`, `role`, `iat`, `exp`.
  - Expiry: Strictly **15 minutes**.
  - Signing Key: Cryptographically random 256-bit secret string (HS256) or RSA 4096-bit private key (RS256).
- **Refresh Tokens & Rotation:**
  - Stored inside an `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
  - Expiry: **7 days**.
  - **Token Rotation:** Every call to `/api/v1/auth/refresh` invalidates the previous refresh token and issues a brand-new token pair. If a revoked refresh token is replayed, the entire session family is terminated immediately (Replay Attack Defense).

### 2.3 Brute-Force & Credential Stuffing Defenses
- Consecutive failed login attempts against a single email are tracked via an in-memory sliding window or Redis rate-limiter.
- After **5 consecutive failures**, the account enters a 15-minute progressive cooldown lockout.
- Authentication responses return generic error messages ("Invalid email or password") to prevent user enumeration.

---

## 3. Authorization & Row Level Security (RLS)

```
+---------------------------------------------------------------------------------+
|                       Zero-Trust Authorization Architecture                     |
|                                                                                 |
|  [ React Frontend ]                                                             |
|         |                                                                       |
|         | (1) REST API + Bearer JWT (15 min lifespan)                           |
|         v                                                                       |
|  [ FastAPI Backend Gateway ]                                                    |
|         |                                                                       |
|         | (2) Decodes JWT, validates signature, extracts user_id & role         |
|         | (3) Opens DB session & injects: SET LOCAL request.jwt.claim.sub = ID  |
|         v                                                                       |
|  [ PostgreSQL Database (Supabase) ]                                             |
|         |                                                                       |
|         +---> RLS Engine enforces: WHERE user_id = auth.uid()                   |
|               (Prevents access to any other patient record)                     |
+---------------------------------------------------------------------------------+
```

### Critical Architecture Rules
1. **No Direct Client DB Access:** The React application has **zero direct connectivity** to Supabase PostgREST or Supabase JS SDK using `anon` keys for health data. All queries must flow through FastAPI to guarantee server-side schema validation, inference execution, and audit logging.
2. **Service Role Safeguards:** The backend's high-privilege service credentials are never compiled into frontend static assets or shared with external microservices.

---

## 4. Input Validation, Sanitization & Anti-Injection

### 4.1 Strict Pydantic v2 Schema Bounds
All request parameters are enforced using Pydantic v2 models before reaching business logic or ML pipelines. Floating-point biomarkers undergo physiological boundary validation:

```python
from pydantic import BaseModel, Field, field_validator

class DiabetesAssessmentInput(BaseModel):
    glucose: float = Field(..., ge=40.0, le=400.0, description="Fasting glucose in mg/dL")
    blood_pressure_systolic: float = Field(..., ge=60.0, le=250.0, description="Systolic BP in mmHg")
    blood_pressure_diastolic: float = Field(..., ge=40.0, le=150.0, description="Diastolic BP in mmHg")
    bmi: float = Field(..., ge=10.0, le=65.0, description="Body Mass Index")
    age: int = Field(..., ge=18, le=120, description="Chronological age")

    @field_validator("blood_pressure_diastolic")
    @classmethod
    def validate_bp_logic(cls, v: float, info) -> float:
        systolic = info.data.get("blood_pressure_systolic")
        if systolic and v >= systolic:
            raise ValueError("Diastolic blood pressure must be strictly lower than systolic pressure.")
        return v
```

### 4.2 SQL Injection Immunity
All database interactions use SQLAlchemy 2.0 typed queries and parameterized SQL statements. Raw string concatenation in queries is strictly prohibited across the codebase.

### 4.3 Cross-Site Scripting (XSS) & Content Security Policy (CSP)
- React handles JSX template escaping natively, neutralizing reflection XSS.
- The web server enforces strict HTTP security headers:
  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.healthsync.ai; frame-ancestors 'none';
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  ```

---

## 5. Secrets Management & Environment Isolation

### 5.1 Environment File Hierarchy
Configuration follows the Twelve-Factor App methodology:
- `.env.example`: Committed template documenting all configuration keys with non-sensitive dummy placeholders.
- `.env.development`: Local development values (localhost URLs, dummy test keys).
- `.env.test`: Dedicated in-memory DB or temporary SQLite instance configurations for Pytest and Vitest.
- `.env.production`: Injected strictly at runtime via deployment environment secret managers (e.g., Docker secrets, Cloud Run Secret Manager).

### 5.2 Git Exclusion
The repository root `.gitignore` rigorously excludes:
```gitignore
.env
.env.*
!.env.example
*.pem
*.key
*.joblib.backup
```

---

## 6. Audit Logging & Compliance Monitoring

### 6.1 Anonymized IP Hashing
To balance audit trail non-repudiation with patient privacy rights, raw IP addresses are **never** stored in plaintext. The system hashes the IP with a rotating monthly salt:
$$\text{ip\_address\_hash} = \text{SHA256}(\text{raw\_client\_ip} + \text{salt})$$

### 6.2 Sensitive Log Redaction
The structured JSON logging system (`app/core/logging.py`) implements automated log filters that scrub:
- Passwords and confirmation fields.
- Authorization Bearer tokens.
- Raw clinical biomarker inputs.
- Refresh cookie values.

---

## 7. Patient Data Rights ("Right to be Forgotten")

HealthSync AI provides complete automated support for patient data self-determination:
1. **Data Export (`POST /api/v1/profile/export-data`):** Asynchronously compiles a machine-readable JSON bundle containing user demographic information, complete assessment history, and generated report links.
2. **Account Deletion (`DELETE /api/v1/profile/delete-account`):**
   - Applies immediate `deleted_at = CURRENT_TIMESTAMP` to the user record and linked assessments.
   - Revokes all active refresh tokens and terminates sessions.
   - Dispatches a background job that schedules permanent database row purging after a 30-day regulatory grace period.
   - Anonymizes references in `audit_logs` by disassociating the user UUID.

---

## 8. Development Isolation & Synthetic Data Mandate

> [!IMPORTANT]
> **DEVELOPMENT SECURITY POLICY: ZERO REAL PROTECTED HEALTH INFORMATION**  
> Under no circumstances may real patient names, actual medical records, hospital patient IDs, or live clinical files be committed to this repository or imported into development/staging databases.  
> 
> * All development testing must utilize **de-identified public research datasets** (e.g., CDC BRFSS, UCI Machine Learning Repository) or **mathematically synthesized fixtures** generated via tools like Faker.
> * CI/CD pipelines must immediately fail if any payload matching structured PII patterns is detected in committed assets.
