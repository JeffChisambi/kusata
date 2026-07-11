# syntax=docker/dockerfile:1
# Build the TanStack Start / Nitro server bundle with Bun, then run it on Node.
# Requires vite.config.ts to set `nitro: { preset: "node-server" }` so that
# `bun run build` emits `.output/server/index.mjs`.

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# VITE_API_URL is baked in at build time (client bundle inlines it).
ARG VITE_API_URL=https://api.kapwanje.com
ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NODE_ENV=production PORT=5000 HOST=0.0.0.0
EXPOSE 5000
CMD ["node", ".output/server/index.mjs"]
