# Build the static Pawn Patrol SPA from the repo root, then serve it plus the
# live-game WebSocket server from a small Node runtime.
# Build context must be the REPO ROOT: docker build -f hackweek-deploy/Dockerfile .

FROM node:24-slim AS spa
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=6144" NODE_ENV=production SENTRY_UI_DEV_ONLY=1 \
    node_modules/.bin/rspack --mode production \
 && rm -rf src/sentry/static/sentry/dist/sourcemaps

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY hackweek-deploy/package.json ./
RUN npm install --omit=dev
COPY hackweek-deploy/server.mjs ./
COPY --from=spa /repo/src/sentry/static/sentry/dist ./dist
EXPOSE 8080
CMD ["node", "server.mjs"]
