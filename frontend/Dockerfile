# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Next.js storefront image (multi-stage). Produces a minimal runner that serves
# the standalone server (output: 'standalone' in next.config.mjs) on :3000 as a
# non-root user. NEXT_PUBLIC_* values are baked at build time — they are public.
# ---------------------------------------------------------------------------

# --- deps: install node_modules from the lockfile (cached) -------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build: compile the standalone server -----------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public build-time config. Override at build with --build-arg.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runner: minimal image with just the standalone output ------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as the built-in non-root `node` user.
USER node

# The standalone build bundles a trimmed node_modules + server.js; static/ and
# public/ assets must be copied alongside it.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
