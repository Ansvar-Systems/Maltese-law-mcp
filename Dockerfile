# Auto-generated Dockerfile for Law MCP HTTP transport.
# Built by rollout-http-transport.sh from Ansvar-Architecture-Documentation.

# ── Stage 1: Build ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
# Patch Alpine packages: openssl CVE-2026-2673, CVE-2026-31790; zlib CVE-2026-27171
RUN apk upgrade --no-cache
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
# Patch Alpine packages: openssl CVE-2026-2673, CVE-2026-31790; zlib CVE-2026-27171
RUN apk upgrade --no-cache
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
COPY data/database.db ./data/database.db

# Security: non-root user
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs \
 && chown -R nodejs:nodejs /app/data
USER nodejs

ENV NODE_ENV=production
CMD ["node", "dist/http-server.js"]
