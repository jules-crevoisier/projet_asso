# syntax=docker/dockerfile:1.7
# Image de production d'Assos Troyes — multi-étapes, basée sur Alpine.

ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.24

# ---------- 1. Dépendances ----------
# better-sqlite3 embarque ses binaires précompilés (dont Alpine x64/arm64) :
# aucune compilation, aucun paquet système à installer.
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund

# ---------- 2. Compilation du CSS, puis retrait des dépendances de développement ----------
FROM deps AS build
COPY styles ./styles
COPY views ./views
COPY public ./public
COPY src ./src
RUN npm run build:css \
 && npm prune --omit=dev --no-audit --no-fund \
 # better-sqlite3 : on ne garde que le binaire Alpine (les sources de SQLite et les
 # binaires des autres systèmes pèsent ~25 Mo)
 && cd node_modules/better-sqlite3 \
 && rm -rf deps src build binding.gyp \
 && find prebuilds -type f -not -name 'linuxmusl-*' -delete \
 && cd /app \
 && find node_modules -type f \( -name '*.md' -o -name '*.map' -o -name '*.d.ts' -o -name '*.ts' -not -name '*.d.ts' \) -delete \
 && rm -rf node_modules/fullcalendar/*.cjs node_modules/fullcalendar/*.js.map

# ---------- 3. Image finale : Alpine nue + le binaire Node, sans npm/yarn/corepack ----------
# On copie seulement node et ses deux bibliothèques : ~25 Mo de moins et moins de surface d'attaque.
# Pas de gestionnaire d'init : server.js gère SIGTERM (arrêt propre) et ne lance aucun sous-processus.
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS node
FROM alpine:${ALPINE_VERSION} AS runtime
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/lib/libstdc++.so.6 /usr/lib/libgcc_s.so.1 /usr/lib/
RUN addgroup -g 1000 node \
 && adduser -u 1000 -G node -s /bin/sh -D node \
 && mkdir -p /data /app \
 && chown node:node /data
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/assos.db \
    NODE_OPTIONS=--max-old-space-size=256

COPY --chown=node:node package.json server.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node views ./views
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node public ./public
COPY --from=build --chown=node:node /app/public/css ./public/css
COPY --from=build --chown=node:node /app/node_modules ./node_modules

USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1

CMD ["node", "server.js"]
