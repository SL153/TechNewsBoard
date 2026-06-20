# syntax=docker/dockerfile:1

# ============================================================
# deps — install node_modules (cached layer)
# ============================================================
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ============================================================
# builder — compile the Next.js standalone server
# ============================================================
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ============================================================
# runner — app + bundled Redis in a single image
# ============================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# The bundled Redis lives on localhost inside the container.
ENV REDIS_URL=redis://127.0.0.1:6379

# Redis (cache) + tini (PID 1 / signal handling / zombie reaping).
RUN apk add --no-cache redis tini

# Non-root runtime user.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone server output (server.js + minimal node_modules).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Redis RDB persistence directory.
RUN mkdir -p /data && chown -R nextjs:nodejs /data
VOLUME /data

# Entrypoint that launches Redis then the Node server.
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
