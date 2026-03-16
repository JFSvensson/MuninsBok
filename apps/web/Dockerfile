# Build stage
FROM node:25-alpine AS builder

RUN npm install -g pnpm@8.15.0

WORKDIR /app

# Copy workspace config and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY packages/core ./packages/core
COPY apps/web ./apps/web

# Re-link workspace bins after full source copy
RUN pnpm install --frozen-lockfile

# Build core first (web depends on it)
RUN pnpm --filter @muninsbok/core build
RUN pnpm --filter @muninsbok/web build

# Production stage - nginx
FROM nginx:1.29-alpine AS runner

# Copy built files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
