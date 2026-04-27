# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal investment assistant monorepo (개인 투자 어시스턴트). Three independent backend modules—investment journal (journal), stock analysis reports (report), and backtesting (backtest)—plus a gateway and a Next.js frontend.

## Technology Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm + Turborepo |
| Backend (journal, report, gateway) | NestJS + TypeScript + TypeORM |
| Backend (backtest) | Python FastAPI + Pydantic v2 |
| Database | PostgreSQL |
| Cache | Redis |
| Frontend | Next.js 14 (App Router) + Tailwind + Recharts |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Testing (TS) | Jest + Playwright (E2E) |
| Testing (Python) | pytest |

## Directory Structure

```
apps/
  web/              # Next.js 14 frontend
  api-gateway/      # NestJS, port 3000 — JWT auth + proxy routing
  api-journal/      # NestJS, port 3001 — trade CRUD, positions, analytics
  api-report/       # NestJS, port 3002 — DART/news/indicators + Claude synthesis
  api-backtest/     # Python FastAPI, port 3003 — strategy DSL + vectorbt engine
packages/
  shared-types/     # TypeScript DTOs and enums shared across all TS apps
  db-schema/        # TypeORM entities and migration files
  eslint-config/
  tsconfig/
docs/
  PARALLEL_DEVELOPMENT.md  # git worktree workflow guide
```

## Environment Setup

Copy `.env.example` to `.env` and fill in all values before running any service. Required keys include database credentials, Redis URL, JWT secret, `ANTHROPIC_API_KEY`, `DART_API_KEY`, and Naver API credentials.

## Common Commands

```bash
# Start infrastructure
docker-compose up -d          # PostgreSQL + Redis

# Root (Turborepo — builds packages/* before apps/* automatically)
pnpm install
pnpm dev                      # All TS/Next services in watch mode
pnpm build
pnpm test                     # All Jest suites
pnpm lint

# Individual TS apps (pnpm workspace)
pnpm --filter api-journal dev
pnpm --filter api-report dev
pnpm --filter web dev

# Migrations
pnpm --filter db-schema migration:run
pnpm --filter db-schema migration:generate -- -n <MigrationName>

# Single Jest test file
pnpm --filter api-journal test -- --testPathPattern=trades.service

# E2E (Playwright)
pnpm --filter web test:e2e

# Python backtest service (NOT in pnpm workspace — run manually)
cd apps/api-backtest
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3003
pytest
```

## Architecture Patterns

**NestJS modules** follow controller → service → repository and hexagonal architecture (domain logic separated from infrastructure adapters). External API calls (DART, Naver, yfinance) are wrapped in adapter classes so the domain layer never calls HTTP directly.

**`packages/shared-types`** is the contract layer — all DTOs, request/response types, and enums (`TradeSide`, `Emotion`, `Verdict`) live here and are imported by all TS apps. Never duplicate types.

**`packages/db-schema`** owns TypeORM entities and migrations. All schema changes require a new migration file; never edit existing migrations.

**Report generation flow** (`api-report`): check DB cache (24 h TTL) → `Promise.all([DART, News, Indicators])` → Claude API → parse structured output → persist to DB → return.

**Backtest flow** (`api-backtest`): natural language → Claude API → structured DSL (Pydantic) → vectorbt simulation via `BackgroundTasks` → status tracked in Redis (`PENDING → RUNNING → DONE/FAILED`) → client polls for result.

**Claude API usage:**
1. `api-journal` – monthly coaching reports (trading pattern analysis)
2. `api-report` – stock analysis synthesis (financial + news + indicators)
3. `api-backtest` – natural language → strategy DSL (few-shot prompting)

Prompts live in dedicated files (`prompts/monthly-coaching.ts`, `prompts/stock-analysis.ts`, `app/llm/strategy_parser.py`). Log token usage for cost tracking.

## Parallel Development with Worktrees

Each module is developed in its own git worktree on a feature branch:

```bash
git worktree add ../stock-pile-journal feature/journal
git worktree add ../stock-pile-report  feature/report
git worktree add ../stock-pile-backtest feature/backtest
```

**Module isolation rules:**
- Only modify files inside your assigned `apps/<module>/` directory.
- `packages/shared-types` and `packages/db-schema` are read-only references — coordinate changes via PRs to `main`.
- Merge order: `shared-types` → individual modules → `api-gateway` → integration.

## Code Conventions

- **No `any`** — use `unknown` and narrow the type.
- **No `console.log`** — use the NestJS `Logger` or Python `logging`.
- **No magic numbers** — extract to named constants.
- **Conventional commits**: `feat`, `fix`, `refactor`, `test`, `docs`. Korean commit messages are fine.
- Every public method needs a JSDoc/docstring.
- Every API endpoint needs at least one integration test.
- `class-validator` for NestJS DTO validation; Pydantic v2 for Python.
- Swagger decorators on all NestJS controllers.
- External API calls must be mockable (adapter pattern, inject via DI).
