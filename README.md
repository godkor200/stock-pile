# Stock Pile — 개인 투자 어시스턴트

투자 일지 + 종목 분석 리포트 + 백테스팅을 묶은 개인 투자 어시스턴트.

매매 입력은 **텔레그램 봇(자연어)** 과 **CSV 가져오기** 로만 가능합니다.

## 서비스 구조

| 서비스 | 포트 | 역할 |
|---|---|---|
| `api-gateway` | 3000 | JWT 인증 + 프록시 라우팅 |
| `api-journal` | 3001 | 매매 일지, 포지션, 통계, 챗봇 파싱 |
| `api-report` | 3002 | DART/뉴스/기술지표 + Claude 분석 |
| `api-backtest` | 3003 | 전략 DSL + vectorbt 백테스팅 (Python) |
| `telegram-bot` | 3004 | 텔레그램 봇 webhook |
| `web` | 3005 | Next.js 14 프론트엔드 |

## 빠른 시작

### 1. 필수 요건

- Node.js 20+, pnpm 9+
- Python 3.11+
- Docker (PostgreSQL + Redis용)

### 2. 환경변수

```bash
cp .env.example .env
# .env 파일에서 ANTHROPIC_API_KEY, DART_API_KEY, NAVER_*, TELEGRAM_BOT_TOKEN 입력
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

## 텔레그램 봇 설정

1. [@BotFather](https://t.me/BotFather) 에서 봇 생성 → `TELEGRAM_BOT_TOKEN` 발급
2. 개발 환경: [ngrok](https://ngrok.com/) 또는 [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 로 HTTPS 터널 생성
3. 웹 `/settings/telegram` 에서 6자리 코드 발급 → 봇에 `/link <코드>` 입력

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
