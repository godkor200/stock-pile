FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
ARG NEXT_PUBLIC_JOURNAL_URL
ARG NEXT_PUBLIC_REPORT_URL
ENV NEXT_PUBLIC_JOURNAL_URL=$NEXT_PUBLIC_JOURNAL_URL
ENV NEXT_PUBLIC_REPORT_URL=$NEXT_PUBLIC_REPORT_URL
RUN pnpm --filter @stock-pile/shared-types build
RUN pnpm --filter web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3005
ENV PORT=3005
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
