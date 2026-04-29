# CLAUDE.md

Claude Code 실행 지침. 세션 시작 시 반드시 이 파일을 먼저 읽는다.

## 세션 시작 루틴

1. 이 파일(`CLAUDE.md`) 읽기 — 프로젝트 목적, 스택, 규칙 파악
2. `TASKS.md` 읽기 — 현재 상태 및 다음 태스크 확인 (없으면 넘어간다)
3. 미완료 태스크 중 가장 번호가 낮은 것부터 순서대로 실행
4. 태스크 완료 시 즉시 `TASKS.md`의 해당 항목을 `[x]`로 업데이트
5. 코드 변경 시 관련 md 파일도 함께 업데이트 (`CLAUDE.md`, `TASKS.md`)

## 파일 작업 규칙

- 새 파일 작성 전 해당 경로가 존재하는지 확인
- 기존 파일 덮어쓰기 전 내용 확인 후 수행
- `src/` 외부 파일(`TASKS.md`, `CLAUDE.md`)은 내용 업데이트 외 삭제 금지

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

## 시행착오에서 배운 규칙

실제 개발 중 발생한 문제와 해결책. 같은 실수를 반복하지 않기 위해 반드시 숙지한다.

### TypeORM

**`@ManyToOne`에는 반드시 `@JoinColumn`을 명시한다**
```typescript
// ❌ 잘못 — TypeORM이 컬럼명을 camelCase로 추측해 "userId" 컬럼을 찾으려 함
@ManyToOne(() => UserEntity)
user: UserEntity;

// ✅ 올바름
@ManyToOne(() => UserEntity)
@JoinColumn({ name: 'user_id' })
user: UserEntity;
```

**`@PrimaryGeneratedColumn`도 snake_case 컬럼이면 `name` 옵션 필수**
```typescript
// ❌ DB 컬럼이 session_id인데 TypeORM이 "sessionId"로 INSERT 시도
@PrimaryGeneratedColumn('uuid')
sessionId: string;

// ✅ 올바름
@PrimaryGeneratedColumn('uuid', { name: 'session_id' })
sessionId: string;
```

**QueryBuilder raw string에서 정렬/필터는 컬럼명을 직접 사용한다**
```typescript
// ❌ TypeORM이 camelCase를 컬럼명으로 그대로 전달할 수 있음
.where('trade.userId = :userId', { userId })

// ✅ 실제 DB 컬럼명 사용
.where('trade.user_id = :userId', { userId })
```

### NestJS / 모노레포

**`ConfigModule.forRoot`에 `envFilePath`를 반드시 지정한다**

`pnpm dev`(turborepo)는 각 앱의 디렉토리를 CWD로 설정해 실행하므로 루트 `.env`를 자동으로 찾지 못한다.
```typescript
// ✅ 앱 로컬과 모노레포 루트 둘 다 탐색
ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] })
```

**모든 NestJS 앱에 `enableCors()`를 추가한다**

브라우저에서 다른 포트로 API를 호출할 때 CORS 헤더가 없으면 "Failed to fetch"가 발생한다.
```typescript
app.enableCors({ origin: true, credentials: true });
```

**사용자 식별 헤더는 `x-user-id`로 통일한다**

컨트롤러마다 `Authorization: Bearer` / `x-user-id` 혼용 시 일부 엔드포인트만 동작하는 문제가 생긴다.

### Docker / 데이터베이스

**pgvector를 사용하려면 Docker 이미지를 `pgvector/pgvector:pg16`으로 맞춰야 한다**

`postgres:16-alpine`에는 pgvector 확장이 없어 마이그레이션이 실패한다. `docker-compose.yml`과 `docker-compose.prod.yml` 모두 동일한 이미지를 사용한다.

**로컬 마이그레이션 실행 시 반드시 `.env`를 먼저 로드한다**

`typeorm-ts-node-commonjs`는 `.env`를 자동으로 읽지 않는다.
```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs) && pnpm --filter db-schema migration:run
```

### 빌드

**`packages/` 빌드 결과물이 `src/` 안에 섞이면 직접 삭제 후 재빌드한다**

`outDir`이 없는 상태에서 `tsc`를 실행하면 `.js`/`.d.ts` 파일이 `src/`에 생성된다. 정리 방법:
```bash
find packages/shared-types/src packages/db-schema/src \
  -type f \( -name "*.js" -o -name "*.js.map" -o -name "*.d.ts" -o -name "*.d.ts.map" \) -delete
```

---

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
