FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node scripts/copy-maplibre-worker.mjs && npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Docker sets HOSTNAME to the container ID, and the standalone server binds to
# it. Listen on all interfaces so the host / platform router can reach it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/data ./data
EXPOSE 3000
# Set HOSTNAME at start too: platforms may inject their own at runtime
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
