# Stock Pile — 개인 투자 어시스턴트

투자 일지 + 종목 분석 리포트 + 백테스팅을 묶은 개인 투자 어시스턴트.

매매 입력은 **웹 챗(자연어)** 과 **CSV 가져오기** 로만 가능합니다.

## 시스템 아키텍처

```
클라이언트
  └─ 웹 브라우저
        │
        ▼
  [web :3005]  Next.js 14
        │  REST / SSE
        ▼
  [api-gateway :3000]  JWT 인증 · 프록시
        │
        ├──────────────────────────────┐───────────────────────┐
        ▼                              ▼                       ▼
  [api-journal :3001]        [api-report :3002]     [api-backtest :3003]
   NestJS                      NestJS                  Python FastAPI
   매매일지 / 웹챗(SSE)          DART · 뉴스 · 지표       전략 DSL
   CSV / 통계                   Claude 합성               시뮬레이션
        │                              │                       │
        ├──────────────────────────────┘                       │
        ▼                                                      ▼
  [PostgreSQL :5433]                                     [Redis :6379]
  [Redis :6379]

외부 API
  Claude AI  ←── api-journal (웹챗), api-report (합성), api-backtest (DSL 파싱)
  DART        ←── api-report
  Naver       ←── api-report
  pykrx · yfinance ←── api-backtest
```

## 매매 입력 흐름

신규 매매는 **웹 챗(자연어)** 과 **CSV 가져오기** 두 경로로만 진입합니다.

```
웹 챗 경로 (SSE)
  사용자 자연어 입력
    → [web] SSE 요청
    → [api-journal] ChatInputService
         Claude Tool Use 로 구조화 추출
    → StocksService 종목 매칭
         ├─ 후보 多 → 모호 선택지 응답 → 사용자 확정
         └─ 후보 1 → TradesService.createFromChat
    → PostgreSQL (trades · positions)

CSV 경로
  사용자 CSV 업로드
    → [web] POST /import/preview
    → ImportService 브로커 자동감지 + preview 응답
    → 사용자 확정
    → TradesService.createFromCsv
    → PostgreSQL (trades · positions)
```

## 서비스 구조

| 서비스 | 포트 | 역할 |
|---|---|---|
| `api-gateway` | 3000 | JWT 인증 + 프록시 라우팅 |
| `api-journal` | 3001 | 매매 일지, 포지션, 통계, 웹챗(SSE) |
| `api-report` | 3002 | DART/뉴스/기술지표 + Claude 분석 |
| `api-backtest` | 3003 | 전략 DSL + vectorbt 백테스팅 (Python) |
| `web` | 3005 | Next.js 14 프론트엔드 |

## 빠른 시작

### 1. 필수 요건

- Node.js 20+, pnpm 9+
- Python 3.11+
- Docker (PostgreSQL + Redis용)

### 2. 환경변수

```bash
cp .env.example .env
# .env 파일에서 ANTHROPIC_API_KEY, DART_API_KEY, NAVER_* 입력
```

### 3. 인프라 시작

```bash
docker-compose up -d
```

### 4. 의존성 설치

```bash
pnpm install

# Python (백테스팅)
cd apps/api-backtest
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

### 5. DB 마이그레이션

```bash
pnpm db:migrate
```

### 6. 개발 서버

```bash
# TypeScript 서비스 전체 (Turborepo)
pnpm dev

# Python 백테스팅 서비스 (별도 터미널)
cd apps/api-backtest && source .venv/bin/activate
uvicorn app.main:app --reload --port 3003
```

## API 문서

각 서비스 실행 후 Swagger:
- Gateway: http://localhost:3000/docs
- Journal: http://localhost:3001/docs
- Report: http://localhost:3002/docs
- Backtest: http://localhost:3003/docs

전체 OpenAPI 스펙: `apps/api-gateway/openapi.yaml`

## 외부 API 키 발급

- **DART**: https://opendart.fss.or.kr/ (기업 재무제표)
- **Naver**: https://developers.naver.com/ (뉴스 검색)
- **Anthropic**: https://console.anthropic.com/ (Claude API)

## 테스트

```bash
pnpm test                                          # 전체 Jest 테스트
pnpm --filter api-journal test                     # 단일 서비스
pnpm --filter api-journal test -- --testPathPattern=trades  # 단일 파일
pnpm --filter web test:e2e                         # Playwright E2E
cd apps/api-backtest && pytest                     # Python 테스트
```
