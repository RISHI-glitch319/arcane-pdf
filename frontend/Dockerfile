# Stage 1: Dependencies
FROM node:22-bookworm-slim as dependencies

WORKDIR /app
COPY package*.json ./

# Install with production optimizations
RUN npm ci --no-audit --prefer-offline --omit=dev && \
    npm cache clean --force

# Stage 2: Builder
FROM node:22-bookworm-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci --no-audit --prefer-offline

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build && \
    npm cache clean --force

# Stage 3: Runtime
FROM node:22-bookworm-slim

WORKDIR /app

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only production dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy package.json
COPY --from=dependencies /app/package*.json ./

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f -s http://localhost:3000 || exit 1

# Run Next.js production server on 0.0.0.0
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]