# Build stage
FROM node:24-alpine AS builder

RUN npm install -g pnpm@8.15.0

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
FROM node:24-alpine AS runner

RUN npm install -g pnpm@8.15.0

WORKDIR /app

ENV NODE_ENV=production

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

# Prisma module/CLI is needed at runtime for migrate deploy and prisma.config.ts imports
RUN npm install prisma@7.4.2 --no-save

# Run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

# Run migrations and start server
CMD ["sh", "-c", "(npx prisma migrate deploy --config packages/db/prisma.config.ts --schema packages/db/prisma/schema.prisma || npx prisma db push --accept-data-loss --config packages/db/prisma.config.ts --schema packages/db/prisma/schema.prisma) && node apps/api/dist/index.js"]
