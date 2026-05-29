# syntax=docker/dockerfile:1

# ─── Stage 1: build normalized data + static site ───────────────────────────
# bookworm-slim (glibc) matches the platform the lockfile was resolved on,
# so npm ci installs the right native optional deps (Rollup/esbuild) cleanly.
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install deps first for better layer caching. Workspace package.jsons + the
# root lockfile are enough for `npm ci`.
COPY package.json package-lock.json ./
COPY data/package.json ./data/package.json
COPY web/package.json ./web/package.json
RUN npm ci

# Bring in the rest of the sources (node_modules & generated output are
# excluded via .dockerignore).
COPY . .

# Build the dataset (uses data/raw/assets.json if present, else the committed
# fixture) then the static site. Output: /app/web/dist
RUN npm run data:build && npm run web:build

# ─── Stage 2: serve static files with nginx ─────────────────────────────────
FROM nginx:1.27-alpine AS runner
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
