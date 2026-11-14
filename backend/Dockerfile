# ==============================================================================
# HealthSync AI — Production Backend Container
# Multi-stage reproducible build for FastAPI + Scikit-learn + SHAP ML inference
# Build Context: Repository root (e.g., `docker build -f backend/Dockerfile -t healthsync-backend .`)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder (Dependency compilation & wheel caching)
# ------------------------------------------------------------------------------
FROM python:3.11.11-slim-bookworm AS builder

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install build dependencies for C-extensions (psycopg, argon2-cffi, numpy/scipy)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create isolated virtual environment for reproducible shipping
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade packaging tools
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install dependencies from pinned requirements file
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ------------------------------------------------------------------------------
# Stage 2: Final Runtime Image (Minimal attack surface, non-root)
# ------------------------------------------------------------------------------
FROM python:3.11.11-slim-bookworm AS runner

# Operational environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/opt/venv/bin:$PATH" \
    HOST=0.0.0.0 \
    PORT=8000 \
    ML_MODELS_DIR=/app/ml/artifacts

WORKDIR /app

# Install minimal runtime shared libraries (libpq for PostgreSQL, curl for health check)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user and group
RUN groupadd -g 10001 healthsync && \
    useradd -u 10001 -g healthsync -s /bin/bash -m healthsync

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Create directories for writable SQLite storage and logs if used
RUN mkdir -p /app/data && chown -R healthsync:healthsync /app/data

# Copy application source, migrations, and ML model artifacts with non-root ownership
COPY --chown=healthsync:healthsync backend/app /app/app
COPY --chown=healthsync:healthsync backend/alembic /app/alembic
COPY --chown=healthsync:healthsync backend/alembic.ini /app/alembic.ini
COPY --chown=healthsync:healthsync ml/artifacts /app/ml/artifacts

# Switch to non-root execution
USER healthsync

# Expose internal FastAPI port
EXPOSE 8000

# Container healthcheck using existing FastAPI health probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Graceful production startup using Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
