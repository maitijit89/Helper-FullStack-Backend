# ==============================================================================
# Multi-Stage Dockerfile for Helping Services Main Backend (Node.js 22 LTS)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & TypeScript Compilation
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy TypeScript source and compile
COPY src ./src
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

# Security: Install dumb-init or wget for reliable PID 1 signal handling & healthcheck
RUN apk add --no-cache dumb-init wget

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=8000 \
    HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Set ownership to unprivileged 'node' user for container security hardening
RUN chown -R node:node /usr/src/app

# Run as non-root user
USER node

# Expose HTTP port
EXPOSE 8000

# Container Healthcheck probe hitting Express health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/api/v1/health || exit 1

# dumb-init handles kernel signals (SIGTERM, SIGINT) gracefully for zero-downtime shutdown
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
