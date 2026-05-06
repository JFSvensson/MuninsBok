# Build stage
FROM node:22-alpine AS builder

RUN npm install -g pnpm@11.0.6

WORKDIR /app

# Copy workspace config and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY packages/core ./packages/core
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Re-link workspace bins after full source copy
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/muninsbok pnpm --filter @muninsbok/db exec prisma generate

# Build packages
RUN pnpm --filter @muninsbok/core build
RUN pnpm --filter @muninsbok/db build
RUN pnpm --filter @muninsbok/api build

# Production stage
FROM node:22-alpine AS runner

RUN npm install -g pnpm@11.0.6
RUN apk add --no-cache poppler-utils

WORKDIR /app

ENV NODE_ENV=production
ENV DB_MIGRATION_MODE=deploy

# Copy built files and dependencies
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db/prisma.config.ts ./packages/db/
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Ensure db package can resolve workspace core package at runtime
RUN mkdir -p /app/packages/db/node_modules/@muninsbok && ln -sf /app/packages/core /app/packages/db/node_modules/@muninsbok/core

# Install Prisma CLI locally so prisma/config can be resolved from workspace paths.
RUN npm install --no-save prisma@7.8.0

# Run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

# Run migrations and start server
CMD ["sh", "-ec", "MODE=\"${DB_MIGRATION_MODE:-deploy}\"; SCHEMA='packages/db/prisma/schema.prisma'; CONFIG='packages/db/prisma.config.ts'; echo \"DB migration mode: ${MODE}\"; case \"$MODE\" in deploy) npx prisma migrate deploy --config \"$CONFIG\" --schema \"$SCHEMA\" ;; fallback) npx prisma migrate deploy --config \"$CONFIG\" --schema \"$SCHEMA\" || npx prisma db push --accept-data-loss --config \"$CONFIG\" --schema \"$SCHEMA\" ;; push) npx prisma db push --accept-data-loss --config \"$CONFIG\" --schema \"$SCHEMA\" ;; skip) echo 'Skipping DB migration step' ;; *) echo \"Invalid DB_MIGRATION_MODE: $MODE (allowed: deploy, fallback, push, skip)\" >&2; exit 1 ;; esac; exec node apps/api/dist/index.js"]
