# CLAUDE.md

Claude Code 실행 지침. 세션 시작 시 반드시 이 파일을 먼저 읽는다.

## 세션 시작 루틴

1. 이 파일(`CLAUDE.md`) 읽기 — 프로젝트 목적, 스택, 규칙 파악
2. `TASKS.md` 읽기 — 현재 상태 및 다음 태스크 확인 (없으면 넘어간다)
3. 미완료 태스크 중 가장 번호가 낮은 것부터 순서대로 실행
4. 태스크 완료 시 즉시 `TASKS.md`의 해당 항목을 `[x]`로 업데이트
5. 코드 변경 시 관련 md 파일도 함께 업데이트 (`CLAUDE.md`, `TASKS.md`)

> 시행착오 규칙 → [`docs/LESSONS_LEARNED.md`](docs/LESSONS_LEARNED.md)

## 파일 작업 규칙

- 새 파일 작성 전 해당 경로가 존재하는지 확인
- 기존 파일 덮어쓰기 전 내용 확인 후 수행
- `src/` 외부 파일(`TASKS.md`, `CLAUDE.md`)은 내용 업데이트 외 삭제 금지

## 프로젝트 개요

개인 투자 어시스턴트 모노레포. 투자 일지(journal), 종목 분석 리포트(report), 백테스트(backtest) 세 개의 독립 백엔드 모듈과 게이트웨이, Next.js 프론트엔드로 구성된다.

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 모노레포 | pnpm + Turborepo |
| 백엔드 (journal, report, gateway) | NestJS + TypeScript + TypeORM |
| 백엔드 (backtest) | Python FastAPI + Pydantic v2 |
| 데이터베이스 | PostgreSQL + pgvector |
| 캐시 | Redis |
| 프론트엔드 | Next.js 14 (App Router) + Tailwind + Recharts |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) / Groq API |
| 테스트 (TS) | Jest + Playwright (E2E) |
| 테스트 (Python) | pytest |

## 디렉토리 구조

```
apps/
  web/              # Next.js 14 프론트엔드
  api-gateway/      # NestJS, port 3000 — JWT 인증 + 프록시 라우팅
  api-journal/      # NestJS, port 3001 — 매매 CRUD, 포지션, 분석
  api-report/       # NestJS, port 3002 — DART/뉴스/지표 + Claude 합성
  api-backtest/     # Python FastAPI, port 3003 — 전략 DSL + vectorbt 엔진
packages/
  shared-types/     # 전체 TS 앱에서 공유하는 DTO, 열거형
  db-schema/        # TypeORM 엔티티 및 마이그레이션
  eslint-config/
  tsconfig/
docs/
  LESSONS_LEARNED.md       # 시행착오 규칙
  PARALLEL_DEVELOPMENT.md  # git worktree 워크플로우
```

## 환경 설정

`.env.example`을 `.env`로 복사 후 값을 채운다. 필수 항목: DB 자격증명, Redis URL, `ANTHROPIC_API_KEY` 또는 `GROQ_API_KEY`, `DART_API_KEY`, Naver API 자격증명.

## 주요 명령어

```bash
# 인프라 시작
docker-compose up -d          # PostgreSQL(pgvector) + Redis

# 루트 (Turborepo — packages/* 를 apps/* 보다 먼저 빌드)
pnpm install
pnpm dev                      # 전체 TS/Next 서비스 watch 모드 (포트 자동 정리 포함)
pnpm build
pnpm test                     # 전체 Jest 스위트
pnpm lint

# 개별 앱
pnpm --filter api-journal dev
pnpm --filter api-report dev
pnpm --filter web dev

# 마이그레이션 (반드시 .env 로드 후 실행)
export $(grep -v '^#' .env | grep -v '^$' | xargs) && pnpm --filter db-schema migration:run
pnpm --filter db-schema migration:generate -- -n <마이그레이션이름>

# 단일 Jest 테스트
pnpm --filter api-journal test -- --testPathPattern=trades.service

# E2E (Playwright)
pnpm --filter web test:e2e

# Python 백테스트 서비스 (pnpm workspace 외부 — 수동 실행)
cd apps/api-backtest
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3003
pytest
```

## 아키텍처 패턴

**NestJS 모듈**은 controller → service → repository 구조와 헥사고날 아키텍처를 따른다. 외부 API 호출(DART, Naver, yfinance)은 어댑터 클래스로 감싸 도메인 레이어가 HTTP를 직접 호출하지 않는다.

**`packages/shared-types`** 는 계약 레이어다. 모든 DTO, 요청/응답 타입, 열거형(`TradeSide`, `Emotion`, `Verdict`)이 여기에 정의되며 전체 TS 앱에서 임포트한다. 타입 중복 금지.

**`packages/db-schema`** 는 TypeORM 엔티티와 마이그레이션을 소유한다. 스키마 변경 시 반드시 새 마이그레이션 파일을 생성하고, 기존 마이그레이션은 절대 수정하지 않는다.

**리포트 생성 흐름** (`api-report`): DB 캐시 확인 (24h TTL) → `Promise.all([DART, 뉴스, 지표])` → Claude API → 구조화 출력 파싱 → DB 저장 → 반환.

**백테스트 흐름** (`api-backtest`): 자연어 → Claude API → 구조화 DSL (Pydantic) → vectorbt 시뮬레이션 (`BackgroundTasks`) → 상태를 Redis로 추적 (`PENDING → RUNNING → DONE/FAILED`) → 클라이언트 폴링.

**Claude/Groq API 사용처:**
1. `api-journal` — 챗봇 매매 파싱 (Groq llama-3.1-8b-instant, 기본값)
2. `api-report` — 종목 분석 합성 (Anthropic Claude)
3. `api-backtest` — 자연어 → 전략 DSL (few-shot 프롬프팅)

프롬프트는 전용 파일에 보관한다 (`prompts/parse-trade.prompt.ts`, `prompts/stock-analysis.ts`, `app/llm/strategy_parser.py`). 토큰 사용량은 비용 추적을 위해 로깅한다.

## Worktree 병렬 개발

각 모듈은 별도 git worktree의 feature 브랜치에서 개발한다:

```bash
git worktree add ../stock-pile-journal feature/journal
git worktree add ../stock-pile-report  feature/report
git worktree add ../stock-pile-backtest feature/backtest
```

**모듈 격리 규칙:**
- 담당 `apps/<모듈>/` 디렉토리 내 파일만 수정한다.
- `packages/shared-types`와 `packages/db-schema`는 읽기 전용 — 변경 시 `main`에 별도 PR.
- 병합 순서: `shared-types` → 개별 모듈 → `api-gateway` → 통합.

## 코드 컨벤션

- **`any` 금지** — `unknown`을 사용하고 타입을 좁힌다.
- **`console.log` 금지** — NestJS `Logger` 또는 Python `logging`을 사용한다.
- **매직 넘버 금지** — 상수로 추출한다.
- **Conventional Commits**: `feat`, `fix`, `refactor`, `test`, `docs`. 한국어 커밋 메시지 허용.
- 모든 public 메서드에 JSDoc/docstring 작성.
- 모든 API 엔드포인트에 통합 테스트 작성.
- NestJS DTO 검증은 `class-validator`, Python은 Pydantic v2.
- 모든 NestJS 컨트롤러에 Swagger 데코레이터 추가.
- 외부 API 호출은 어댑터 패턴으로 추상화 (DI로 주입).
