# syntax=docker/dockerfile:1
# Build the TanStack Start / Nitro server bundle with Node, then run it on Node.
# Requires vite.config.ts to set `nitro: { preset: "node-server" }` so that
# `npm run build` emits `.output/server/index.mjs`.

FROM node:22-alpine AS build
WORKDIR /app

# Copy only package.json first to leverage Docker cache
COPY package.json ./

# Use npm install. npm is much more resilient to Docker network/DNS/IPv6 quirks than bun.
RUN npm install

COPY . .

# VITE_API_URL is baked in at build time (client bundle inlines it).
ARG VITE_API_URL=https://api.kapwanje.com
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NODE_ENV=production PORT=5000 HOST=0.0.0.0
EXPOSE 5000
CMD ["node", ".output/server/index.mjs"]
