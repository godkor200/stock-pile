FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/db-schema/package.json ./packages/db-schema/
COPY apps/api-report/package.json ./apps/api-report/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY packages/ ./packages/
COPY apps/api-report/ ./apps/api-report/
RUN pnpm --filter @stock-pile/shared-types build
RUN pnpm --filter @stock-pile/db-schema build
RUN pnpm --filter api-report build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/db-schema/package.json ./packages/db-schema/
COPY apps/api-report/package.json ./apps/api-report/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/db-schema/dist ./packages/db-schema/dist
COPY --from=builder /app/apps/api-report/dist ./apps/api-report/dist

WORKDIR /app/apps/api-report
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "dist/main"]
