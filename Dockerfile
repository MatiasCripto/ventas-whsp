# ── Concierge AI Dockerfile ──────────────────────────────────
# Multi-stage build: minimal production image.

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Prune dev dependencies for smaller runner
RUN npm prune --production

# ─────────────────────────────────────────────────────────────
# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 concierge && \
    adduser --system --uid 1001 concierge

# Copy built assets from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Set ownership to non-root user
RUN chown -R concierge:concierge /app

USER concierge

EXPOSE 3010

CMD ["node", "server.js"]
