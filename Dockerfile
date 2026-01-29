# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base with Bun
# ============================================
FROM oven/bun:1 AS base
WORKDIR /app

# ============================================
# Stage 2: Install dependencies
# ============================================
FROM base AS deps

# Copy package files
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN bun install --frozen-lockfile

# ============================================
# Stage 3: Build shared package
# ============================================
FROM deps AS build-shared

COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# ============================================
# Stage 4: Build frontend
# ============================================
FROM build-shared AS build-web

COPY apps/web ./apps/web

# Build the frontend
WORKDIR /app/apps/web
RUN bun run build

# ============================================
# Stage 5: Build API
# ============================================
FROM build-shared AS build-api

COPY apps/api ./apps/api

# Build the API
WORKDIR /app/apps/api
RUN bun build src/index.ts --outdir dist --target bun --minify

# ============================================
# Stage 6: Production runtime
# ============================================
FROM oven/bun:1-slim AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Copy package files for workspace resolution
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Copy shared package (needed at runtime for types)
COPY packages/shared ./packages/shared

# Copy built API
COPY --from=build-api /app/apps/api/dist ./apps/api/dist
COPY --from=build-api /app/apps/api/src ./apps/api/src

# Copy built frontend static files
COPY --from=build-web /app/apps/web/dist ./apps/api/public

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the server
WORKDIR /app/apps/api
CMD ["bun", "run", "src/index.ts"]
