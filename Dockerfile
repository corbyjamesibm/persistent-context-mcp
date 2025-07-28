# Multi-stage Dockerfile for Persistent Context Store
FROM node:18-alpine AS dependencies

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install production dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY src/ ./src/
COPY docs/ ./docs/

# Build stage
FROM node:18-alpine AS build

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci --silent

# Copy source code
COPY src/ ./src/
COPY docs/ ./docs/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S contextstore && \
    adduser -S contextstore -u 1001

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy production dependencies
COPY --from=dependencies --chown=contextstore:contextstore /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=contextstore:contextstore /app/build ./build

# Copy package.json for runtime
COPY --chown=contextstore:contextstore package.json ./

# Create necessary directories
RUN mkdir -p /app/logs /app/backups /var/tmp && \
    chown -R contextstore:contextstore /app/logs /app/backups /var/tmp

# Switch to non-root user
USER contextstore

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    NODE_OPTIONS="--max-old-space-size=2048"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/index.js"]

# Metadata
LABEL \
    org.opencontainers.image.title="Persistent Context Store" \
    org.opencontainers.image.description="Production-ready AI memory management and context persistence system" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.authors="Digital Design Team" \
    org.opencontainers.image.source="https://github.com/digital-design-team/persistent-context-store" \
    org.opencontainers.image.licenses="MIT"