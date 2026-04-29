FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 의존성 설치 (workspace 전체 필요)
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/db-schema/package.json ./packages/db-schema/
COPY apps/api-journal/package.json ./apps/api-journal/
RUN pnpm install --frozen-lockfile

# 패키지 빌드
FROM deps AS builder
COPY packages/ ./packages/
COPY apps/api-journal/ ./apps/api-journal/
RUN pnpm --filter @stock-pile/shared-types build
RUN pnpm --filter @stock-pile/db-schema build
RUN pnpm --filter api-journal build

# 실행 이미지
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/db-schema/package.json ./packages/db-schema/
COPY apps/api-journal/package.json ./apps/api-journal/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/db-schema/dist ./packages/db-schema/dist
COPY --from=builder /app/apps/api-journal/dist ./apps/api-journal/dist

WORKDIR /app/apps/api-journal
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main"]
