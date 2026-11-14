# ==============================================================================
# HealthSync AI — Production Frontend Container
# Multi-stage build: Vite production compilation + Nginx unprivileged web server
# Build Context: frontend directory (or `docker build -t healthsync-frontend frontend`)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React/TypeScript Application
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies deterministically
COPY package.json package-lock.json ./
RUN npm ci

# Copy frontend source code and configuration
COPY . ./

# Build production assets (TypeScript check + Vite bundler)
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Nginx Server (Unprivileged, Non-root)
# ------------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

# Copy compiled static assets from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Copy optimized unprivileged Nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# Expose unprivileged Nginx port
EXPOSE 8080

# Health check using Nginx health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O - http://localhost:8080/nginx-health || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
