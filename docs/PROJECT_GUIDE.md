# 개인 투자 어시스턴트 - Claude Code 작업 가이드

> **VSCode에서 Claude Code로 작업하는 통합 프롬프트 세트**
>
> 프로젝트 컨셉: 투자 일지 + 분석 리포트 + 백테스팅을 묶은 개인 투자 어시스턴트
>
> 핵심 결정사항:
> - 신규 입력 폼 ❌ → 챗봇 + CSV만 진입점
> - 폼은 오직 수정/회고용 (목록 + 인라인 편집)
> - 텔레그램 봇이 메인 인터페이스 (카카오톡은 추후)
> - git worktree로 3개 모듈 병렬 개발

---

## 📑 목차

1. [Step 0 · 사전 작업 (메인 브랜치, 1일)](#step-0--사전-작업)
2. [Step 1 · worktree 생성](#step-1--worktree-생성)
3. [세션 A · 투자 일지 (apps/api-journal)](#세션-a--투자-일지)
4. [세션 B · 분석 리포트 (apps/api-report)](#세션-b--분석-리포트)
5. [세션 C · 백테스팅 (apps/api-backtest)](#세션-c--백테스팅)
6. [Step 2 · 통합 + 프론트엔드](#step-2--통합--프론트엔드)
7. [개발 순서 권장 (5주 로드맵)](#개발-순서-권장)
8. [참고 자료](#참고-자료)

---

# Step 0 · 사전 작업

> 메인 브랜치에서 혼자 작업. 이 단계가 끝나야 병렬 작업 시작 가능.

## 0-1. 프로젝트 초기 셋업

```
나는 개인 투자 어시스턴트 사이드 프로젝트를 시작하려고 해.
세 개의 모듈이 있어: 투자 일지(journal), 분석 리포트(report), 백테스팅(backtest).

다음 조건으로 모노레포 초기 구조를 만들어줘.

기술 스택:
- 패키지 매니저: pnpm
- 모노레포 도구: Turborepo
- 백엔드(journal, report, gateway): NestJS + TypeORM
- 백엔드(backtest): Python FastAPI (별도 패키지)
- DB: PostgreSQL
- 캐시: Redis
- 프론트엔드: Next.js 14 (App Router) + Tailwind + Recharts
- 공통 타입: TypeScript

디렉토리 구조:
- apps/web (Next.js 프론트엔드)
- apps/api-gateway (NestJS, 포트 3000, 라우팅 + 인증)
- apps/api-journal (NestJS, 포트 3001)
- apps/api-report (NestJS, 포트 3002)
- apps/api-backtest (Python FastAPI, 포트 3003)
- apps/telegram-bot (NestJS, 텔레그램 webhook 처리)
- packages/shared-types (TypeScript 공통 타입)
- packages/db-schema (TypeORM 엔티티)
- packages/eslint-config
- packages/tsconfig

요구사항:
1. 루트 package.json에 turbo, prettier, eslint 셋업
2. docker-compose.yml에 PostgreSQL + Redis 정의
3. .env.example에 필요한 환경변수 템플릿
4. README.md에 실행 가이드
5. .gitignore 적절히 설정

먼저 전체 구조를 설계해서 보여준 다음 진행해줘.
```

## 0-2. DB 스키마 확정

```
공통 데이터 레이어를 정의해야 해. packages/db-schema에 TypeORM 엔티티로 작성해줘.

핵심 테이블:

1. users
   - id, email, password_hash, telegram_user_id (nullable), created_at

2. stocks (종목 마스터)
   - ticker (PK, "005930" 같은 종목코드)
   - name, market, sector, updated_at

3. trades (매매 기록 - 핵심)
   - id, user_id, ticker
   - side (BUY/SELL)
   - quantity, price
   - traded_at
   - reason (텍스트, nullable)
   - emotion (PLANNED/IMPULSIVE/NEWS_REACTION/TECHNICAL/FOMO, nullable)
   - tags (배열)
   - source (CHATBOT/CSV_IMPORT/MANUAL_EDIT) - 어떻게 입력됐는지 추적
   - created_at

4. positions (현재 보유 포지션 캐시)
   - user_id, ticker, quantity, avg_price, realized_pnl, updated_at

5. analysis_reports
   - id, user_id, ticker
   - generated_at
   - financial_summary (jsonb)
   - news_summary (jsonb)
   - technical_indicators (jsonb)
   - claude_analysis (text)
   - verdict (BUY/HOLD/SELL/NEUTRAL)

6. strategies
   - id, user_id, name
   - natural_language (사용자 입력)
   - parsed_dsl (jsonb)
   - created_at

7. backtest_results
   - id, strategy_id, user_id
   - period_start, period_end
   - initial_capital, final_capital
   - total_return, mdd, win_rate, sharpe_ratio
   - trades_log (jsonb)
   - created_at

8. chat_sessions (챗봇 입력 미확정 상태 추적)
   - session_id (uuid, PK)
   - user_id
   - parsed_data (jsonb)
   - missing_fields (배열)
   - status (PENDING/AMBIGUOUS/READY/CONFIRMED/EXPIRED)
   - expires_at

각 테이블에 적절한 인덱스(user_id, ticker, traded_at)를 걸고,
관계(OneToMany, ManyToOne)도 명확하게 설정해줘.
마이그레이션 파일도 함께 생성해줘.
```

## 0-3. 공통 타입 + API 계약

```
packages/shared-types에 세 모듈이 공유할 TypeScript 타입을 정의해줘.

필요한 타입:
1. 모든 엔티티의 DTO (CreateXxxDto, UpdateXxxDto, XxxResponseDto)
2. 모듈 간 통신용 인터페이스
3. 공통 enum (TradeSide, Emotion, Verdict, ChatSessionStatus 등)
4. 페이지네이션, 에러 응답 등 공통 응답 타입
5. 챗봇 파싱 결과 타입 (ParsedTradeFromChat)

apps/api-gateway에 OpenAPI 스펙 초안을 yaml로 작성:
- /api/auth/* → gateway 직접 처리
- /api/journal/* → api-journal:3001
- /api/report/* → api-report:3002
- /api/backtest/* → api-backtest:3003
- /api/chat/* → api-journal:3001 (ChatInputModule)
- /api/telegram/webhook → telegram-bot

각 엔드포인트의 request/response 스키마는 shared-types 참조.
```

## 0-4. 병렬 개발 가이드 + Claude 규칙 파일

```
docs/PARALLEL_DEVELOPMENT.md 파일을 만들어서 git worktree 기반 병렬 개발 가이드 작성.

포함할 내용:
1. worktree 생성 명령어 (journal/report/backtest)
2. 각 worktree에서 다른 모듈은 건드리지 않는 규칙
3. PR 단위 (모듈별 작은 PR 권장)
4. 통합 머지 순서 (shared-types → 각 모듈 → gateway → web)
5. 충돌 발생 시 대응법

추가로 .claude/CLAUDE.md 파일 생성:

# 프로젝트 규칙

## 작업 범위
- 현재 worktree의 담당 모듈만 수정한다
- packages/shared-types, packages/db-schema는 읽기 전용
- 다른 apps/ 디렉토리는 절대 수정하지 않는다

## 코드 품질
- 모든 public 메서드에 JSDoc/docstring 작성
- 모든 엔드포인트에 통합 테스트 작성
- 외부 API 호출은 어댑터로 추상화 (Hexagonal Architecture)
- 에러는 도메인 에러 클래스로 명확히 분류

## 입력 인터페이스 원칙
- 신규 매매 입력은 오직 두 경로: 챗봇(자연어) + CSV(일괄)
- 폼 입력은 만들지 않는다 (수정/회고용 인라인 편집만)
- 모든 매매 기록에는 source 필드를 채운다 (CHATBOT/CSV_IMPORT/MANUAL_EDIT)

## 커밋 규칙
- conventional commits 준수: feat/fix/refactor/test/docs
- 한 커밋은 한 가지 변경만
- 커밋 메시지는 한국어 OK

## 금지 사항
- console.log 남기지 않기 (logger 사용)
- any 타입 사용 금지
- 매직 넘버 금지 (상수로 추출)
- 비동기 함수에서 await 누락 금지
- 신규 매매 입력 폼 만들지 않기
```

---

# Step 1 · worktree 생성

Step 0 PR이 main에 머지된 후 터미널 3개에서:

```bash
# 터미널 1 - 투자 일지
git worktree add ../투자어시스턴트-journal feature/journal
cd ../투자어시스턴트-journal
claude

# 터미널 2 - 분석 리포트
git worktree add ../투자어시스턴트-report feature/report
cd ../투자어시스턴트-report
claude

# 터미널 3 - 백테스팅
git worktree add ../투자어시스턴트-backtest feature/backtest
cd ../투자어시스턴트-backtest
claude
```

각 터미널에서 첫 메시지로 해당 세션의 "초기 컨텍스트 설정" 프롬프트를 던지면 됨.

---

# 세션 A · 투자 일지

> apps/api-journal + apps/telegram-bot
>
> 이 모듈은 매매 기록의 모든 입력/조회/통계 책임. 신규 입력은 챗봇과 CSV만, 폼은 수정용으로만.

## A-0. 초기 컨텍스트 설정

```
나는 apps/api-journal과 apps/telegram-bot 모듈만 작업할 거야.
다른 apps의 코드는 절대 수정하지 마.
packages/shared-types와 packages/db-schema는 읽기 전용으로 참조만.

이 모듈의 책임:
- 매매 기록 CRUD (단, 신규 입력은 챗봇/CSV만, 폼 입력 ❌)
- 보유 포지션 자동 집계
- 매매 통계 (월별 수익률, 승률, 평균 보유 기간)
- 매매 패턴 분석 (Claude API로 월간 코칭 리포트)
- 챗봇 자연어 입력 파싱 (Claude Tool Use)
- 텔레그램 봇 webhook 처리
- CSV 일괄 가져오기

작업 순서:
1. 매매 CRUD 백엔드 (조회/수정/삭제 중심)
2. 종목 검색 + 자동완성
3. CSV 가져오기 (어댑터 패턴)
4. 일괄 편집 + 누락 정보 채우기
5. Claude Tool Use 챗봇 파싱
6. 종목명 매칭 + 확정 흐름
7. 텔레그램 봇 연동
8. 통계 + 코칭 리포트

각 단계마다 테스트 통과 확인하고 다음으로 넘어가.
먼저 모듈 구조와 파일 트리부터 보여줘.
```

## A-1. 매매 CRUD (조회/수정/삭제 중심)

```
TradesModule을 만들어줘.
신규 입력은 챗봇/CSV에서만 들어오니, 이 모듈은 조회/수정/삭제와 내부용 createTrade 서비스에 집중해.

엔드포인트:
- GET /trades : 목록 조회 (페이지네이션, 필터)
- GET /trades/:id : 단건 조회
- PATCH /trades/:id : 수정 (이유, 감정, 태그, 수량, 가격 모두 가능)
- PATCH /trades/bulk : 여러 건 일괄 수정 (CSV로 들어온 빈 reason/emotion 채울 때)
- DELETE /trades/:id : 삭제
- GET /trades/missing-context : reason 또는 emotion이 비어있는 매매 (회고용)
- GET /trades/stats/quick : 대시보드용 빠른 통계

내부 서비스 (다른 모듈에서 호출):
- TradesService.createFromChat(userId, parsedData)
- TradesService.createFromCsv(userId, parsedRows)

createTrade 비즈니스 규칙:
1. SELL 시 보유 수량 검증 (음수 방지) → 부족하면 도메인 에러
2. positions 테이블 자동 갱신 (트랜잭션)
   - BUY: 수량 증가, 평균 매입가 가중평균
   - SELL: 수량 감소, 실현손익 누적
3. ticker가 stocks 마스터에 없으면 stocks 서비스 호출해서 자동 등록
4. 모든 trade에 source 필드 필수 (CHATBOT/CSV_IMPORT/MANUAL_EDIT)

GET /trades 필터:
- ticker, side, emotion, source
- from, to (ISO date)
- has_reason (true: reason 있는 것만, false: 비어있는 것만)
- tags (쉼표 구분)
- sort, page, limit

GET /trades/missing-context 응답 (그룹화 옵션):
- by_ticker: 같은 종목 매매 묶음
- by_date: 같은 날 매매 묶음
- by_side: 매수/매도별 묶음

PATCH /trades/bulk 요청:
{
  trade_ids: [1, 2, 3, ...],
  patch: { reason: "...", emotion: "PLANNED", tags: [...] }
}

테스트:
- 단위: 각 비즈니스 규칙
- 통합 e2e:
  - 매수 → 매도 → 포지션 0 검증
  - 부분 매도 후 평균 매입가 유지
  - 보유 없는 상태 매도 시도 → 400
  - 일괄 수정 시 다른 사용자 trade 제외
  - bulk patch에 빈 patch 거부
```

## A-2. 종목 검색 + 자동완성

```
TradesModule에 종목 검색 추가. 챗봇/UI에서 종목명 매칭에 쓰일 거야.

엔드포인트:
- GET /stocks/search?q=삼성 : 종목명/코드 검색
- GET /stocks/:ticker : 단건 + 현재 시세

요구사항:
1. 종목명(한글, 영문) + 종목코드 모두 매칭
2. 시작 일치 우선 정렬 (삼성 → 삼성전자가 먼저)
3. 상위 10개만 반환
4. 응답:
   {
     ticker: "005930",
     name: "삼성전자",
     market: "KOSPI",
     current_price: 72500,
     change_rate: 0.012
   }

데이터 소스:
- 종목 마스터: pykrx 시드 스크립트 (scripts/seed-stocks.ts)
- 현재 시세: api-report의 IndicatorsModule HTTP 호출
  (지금은 모킹, 나중에 통합)

성능:
- Redis 캐싱 (q 키 30초)
- 시세 1분 캐싱

테스트:
- 한글/영문/코드 검색
- 캐시 hit/miss
- 외부 API 실패 fallback
```

## A-3. CSV 가져오기

```
TradesModule에 CSV 일괄 등록 추가. 한국 주요 증권사 거래내역 파싱.

엔드포인트:
- POST /trades/import/preview : 업로드 → 파싱 결과 미리보기
- POST /trades/import/confirm : 프리뷰 확인 후 실제 저장
- GET /trades/import/templates : 지원 증권사 + CSV 양식

지원 증권사 (1차):
- 키움증권, 한국투자증권, 미래에셋증권, 삼성증권, 토스증권

어댑터 패턴:
- src/import/adapters/kiwoom.adapter.ts
- src/import/adapters/kis.adapter.ts
- ...
- src/import/import.service.ts

interface CsvAdapter {
  detect(headers: string[]): boolean;
  parse(rows: any[]): ParsedTrade[];
}

import 흐름:
1. 파일 업로드 (multer, 최대 10MB)
2. 인코딩 감지 + 변환 (iconv-lite, EUC-KR → UTF-8)
3. CSV 파싱 (papaparse)
4. 헤더로 어댑터 자동 감지
5. ParsedTrade 변환 + 검증
   - ticker stocks 마스터 존재 확인
   - 수량/가격 양수
   - 거래일 미래 아님
   - 동일 user_id + ticker + side + traded_at + price 중복 감지
6. preview 응답:
   {
     detected_broker: "키움증권",
     total_rows: 152,
     valid_rows: 148,
     invalid_rows: [{ row_index: 33, error: "..." }],
     duplicate_rows: 12,
     new_rows: 136,
     preview: [...앞 10건...],
     import_session_id: "uuid"
   }

confirm 단계:
- import_session_id 받아서 다시 호출
- 세션은 Redis 5분 TTL
- 중복 건너뛰고 새 데이터만 저장
- TradesService.createFromCsv 일괄 호출
- positions 재계산
- 트랜잭션, 중간 실패 시 전체 롤백

대용량:
- 1만 행까지 동기 처리
- 그 이상은 BullMQ 비동기 + 작업 ID
- GET /trades/import/jobs/:job_id 진행률

샘플 파일: docs/csv-samples/{broker}-sample.csv

테스트:
- 어댑터별 detect/parse 단위 테스트
- 인코딩 변환
- 잘못된 CSV 에러 처리
- 중복 감지 정확성
- 1만 행 5초 이내 완료

특정 증권사 포맷 모르면 TODO + 인터페이스만 구현해도 OK.
```

## A-4. Claude Tool Use 챗봇 파싱

```
ChatInputModule을 새로 만들어줘. 자연어 매매 입력의 핵심.

엔드포인트:
- POST /chat/parse-trade : 자연어 → 구조화된 매매 객체 (저장 ❌)
- POST /chat/clarify : 정보 부족 시 후속 질문 응답
- POST /chat/confirm-trade : 확정 후 실제 저장

기술:
- @anthropic-ai/sdk
- 모델: claude-sonnet-4-5 (정확도 우선)
- Tool Use 패턴

Tool 정의 (tools/trade-record.tool.ts):

const recordTradeTool = {
  name: "record_trade",
  description: "사용자의 자연어 매매 정보를 구조화. 매수/매도, 수량, 가격, 종목명, 이유, 감정 추출.",
  input_schema: {
    type: "object",
    properties: {
      side: { type: "string", enum: ["BUY", "SELL"] },
      stock_query: { type: "string", description: "사용자가 말한 종목명 그대로" },
      quantity: { type: "number" },
      quantity_unit: { type: "string", enum: ["SHARES", "AMOUNT"] },
      price: { type: "number", description: "주당 가격, 미언급 시 null" },
      use_market_price: { type: "boolean", description: "'시장가로'라고 한 경우 true" },
      reason: { type: "string" },
      emotion: { type: "string", enum: ["PLANNED","IMPULSIVE","NEWS_REACTION","TECHNICAL","FOMO"] },
      confidence: { type: "number", description: "0~1" },
      missing_fields: { type: "array", items: { type: "string" } },
      clarification_question: { type: "string" }
    },
    required: ["side", "stock_query", "confidence"]
  }
}

시스템 프롬프트 (prompts/trade-parser.system.ts):

당신은 한국 개인 투자자의 매매 기록을 정확하게 파싱하는 어시스턴트입니다.

규칙:
1. 모호하면 추측 ❌, missing_fields와 clarification_question 채우기
2. 종목명은 그대로 추출 (ticker 매칭은 시스템이)
3. 가격 누락 시 missing_fields에 'price' 추가
   단 "시장가로", "현재가로"는 use_market_price: true
4. 한국어 숫자 정확 변환:
   - "백만원" = 1,000,000
   - "7만2천원" = 72,000
   - "스무 주" = 20
5. 감정 추론:
   - "갑자기 떨어져서 놨어" → IMPULSIVE
   - "어제부터 분석해서" → PLANNED
   - "뉴스 보고 바로" → NEWS_REACTION
   - "5일선 돌파해서" → TECHNICAL
   - "다들 사길래" → FOMO

few-shot 예제 5개 이상 포함.

작업:
1. ChatInputModule 구조
2. AnthropicClient 래퍼 (재시도, 타임아웃, 비용 로깅)
3. recordTradeTool + 시스템 프롬프트
4. parse-trade 엔드포인트
5. 단위 테스트 (Anthropic API mock)
   - 자연어 30+ 케이스
   - missing_fields 채워지는지
   - 한국어 숫자 변환 정확성
```

## A-5. 종목명 매칭 + 확정 흐름

```
ChatInputModule에 종목 매칭과 확정 흐름 추가.

문제: Claude가 "삼성"이라고 추출해도 ticker로 매칭해야 함.
모호하면 사용자에게 선택지 제공.

흐름:

1. POST /chat/parse-trade
   body: { message: "삼성 10주 7만2천원에 샀어" }
   → Claude 파싱 → stock_query: "삼성"
   → StocksService.searchByQuery("삼성")
   → 후보 다수면:
   {
     status: "AMBIGUOUS_STOCK",
     parsed: { ... },
     candidates: [
       { ticker: "005930", name: "삼성전자" },
       { ticker: "006400", name: "삼성SDI" },
       { ticker: "207940", name: "삼성바이오로직스" }
     ],
     session_id: "uuid",
     prompt: "어떤 삼성을 말씀하신 건가요?"
   }

2. POST /chat/clarify
   body: { session_id, ticker: "005930" }
   → 세션 parsed에 ticker 채움
   → 다른 부족 정보 있으면 또 clarify
   → 모두 채워지면 status: "READY_TO_CONFIRM"

3. POST /chat/confirm-trade
   body: { session_id }
   → TradesService.createFromChat 호출
   → 응답:
   {
     status: "SAVED",
     trade: { ... },
     positions_after: { ticker, quantity, avg_price }
   }

세션 관리:
- chat_sessions 테이블 또는 Redis (session_id 키, 5분 TTL)
- 데이터: { user_id, parsed, missing_fields, history }

엣지 케이스:
- 후보 1개 → 자동 선택
- 후보 0개 → status: "STOCK_NOT_FOUND"
- 시장가 → confirm 시점 현재가로 자동
- "취소" 입력 → 세션 무효화

테스트:
- 모호 종목 → 선택 → 확정 전체 플로우
- 가격 누락 → 시장가 적용
- 5분 후 세션 만료
- 동시 여러 세션 격리
```

## A-6. 텔레그램 봇 연동

```
apps/telegram-bot 모듈 작성. 본인이 매일 쓸 메인 인터페이스.

기술:
- grammY (TypeScript 친화)
- TELEGRAM_BOT_TOKEN
- 개발: long polling, 배포: webhook

요구사항:

1. 사용자 등록
   - /start 명령
   - 텔레그램 user_id ↔ 시스템 user_id 매핑
   - 일회용 인증 토큰:
     a. 웹에서 로그인 후 "텔레그램 연결"
     b. 6자리 코드 생성 (Redis 5분 TTL)
     c. 봇에 /link 123456 입력
     d. 매핑 저장

2. 메시지 처리
   - 일반 텍스트 → ChatInputService.parseTrade
   - 결과 인라인 키보드:
     "✓ 삼성전자 10주 매수, 72,000원
      이유: 실적 기대 / 감정: 계획"
     [저장] [수정] [취소]
   - [저장] → confirm-trade
   - [수정] → 어떤 필드 수정할지 메뉴
   - [취소] → 세션 폐기

3. 명령어
   - /portfolio : 보유 포지션
   - /today : 오늘 매매 요약
   - /summary : 이번 달 통계
   - /undo : 마지막 매매 취소 (5분 이내)
   - /help : 사용법

4. 모호 입력 처리
   - "어떤 삼성을 말씀하신 건가요?"
     [삼성전자] [삼성SDI] [삼성바이오로직스]

5. 에러 처리
   - 인증 안 됨 → /link 안내
   - Claude API 에러 → "잠시 후 다시 시도해주세요"

6. BotFather 명령어 메뉴 자동 등록 코드

7. Rate limiting
   - 사용자당 분당 10회

보안:
- webhook secret token 검증
- 등록 안 된 user_id 무시

테스트:
- 봇 핸들러 단위 (Telegram API mock)
- 인증 플로우 e2e
- 인라인 키보드 콜백
- 동시 여러 사용자 세션 격리

배포:
- HTTPS 필수
- 개발: ngrok/cloudflared
- README에 봇 셋업 가이드
```

## A-7. 통계 + 월간 코칭 리포트

```
AnalyticsModule과 CoachingModule 구현.

AnalyticsModule:
- GET /analytics/summary : 전체 통계
- GET /analytics/monthly : 월별 수익률 추이
- GET /analytics/by-ticker : 종목별 손익
- GET /analytics/by-emotion : 감정별 매매 결과 (충동 vs 계획 승률)
- GET /analytics/by-source : 입력 경로별 통계 (챗봇 vs CSV 매매 비교)

성능:
- Redis 캐싱 (TTL 1시간)
- 집계 쿼리 최적화

CoachingModule:
- POST /coaching/monthly-report : 지난 달 데이터 → Claude → 코칭 리포트
- 프롬프트는 prompts/monthly-coaching.ts 분리
- @anthropic-ai/sdk
- 생성된 리포트 DB 저장 (재호출 방지)

Claude 프롬프트 관점:
1. 매매 빈도, 평균 보유 기간 패턴
2. 손절/익절 일관성
3. 감정별 승률 차이
4. 입력 경로별 패턴 (챗봇 매매가 충동적인지, CSV는 정리된 매매인지)
5. 다음 달 개선 제안 3가지

테스트도 함께.
```

---

# 세션 B · 분석 리포트

> apps/api-report
>
> 종목 코드 → DART + 뉴스 + 기술적 지표 + Claude 종합 분석 → 리포트

## B-0. 초기 컨텍스트 설정

```
나는 apps/api-report만 작업할 거야. 다른 apps는 건드리지 마.
packages/shared-types와 packages/db-schema는 참조만.

이 모듈의 책임:
- 종목 분석 리포트 생성
- 데이터: DART API, 네이버 금융, 네이버 뉴스
- Claude로 종합 분석 → 한국어 리포트
- DB 캐싱 24시간

모듈 구조:
- DartModule (DART API)
- NewsModule (뉴스 수집/필터링)
- IndicatorsModule (RSI, MACD, MA)
- ReportModule (조합 → 최종 리포트)

먼저 외부 API 응답 스키마를 인터페이스로 정의하고,
어댑터 패턴으로 도메인 로직과 분리.
```

## B-1. 외부 API 어댑터

```
DartModule부터.

DART OpenAPI:
- DART_API_KEY 환경변수
- 엔드포인트: 기업개황, 재무제표, 주요사항보고서

메서드:
- getCompanyInfo(ticker)
- getFinancialStatements(ticker, year)
- getRecentDisclosures(ticker, days)

요구사항:
1. axios + 인터셉터로 API 키 자동 첨부
2. Redis 캐싱 1시간
3. rate limit (분당 1000)
4. 에러 fallback

NewsModule:
- 네이버 검색 API (NAVER_CLIENT_ID/SECRET)
- searchNews(keyword, days)
- 중복 제거 (제목 유사도)
- 광고성 필터 (키워드 블랙리스트)

IndicatorsModule:
- 시세: yfinance (.KS suffix) 또는 pykrx 별도 서비스
- technicalindicators npm으로 RSI, MACD, MA
- 30일/90일 추이

각 모듈 독립 테스트, 외부 API mock.
```

## B-2. 통합 리포트 생성

```
ReportModule로 조합.

엔드포인트:
- POST /reports/generate { ticker } : 새 리포트
- GET /reports/:ticker/latest : 최신
- GET /reports/:ticker/history : 과거 목록

흐름:
1. DB 24시간 이내 리포트 있으면 반환
2. 없으면 DART/News/Indicators 병렬 호출 (Promise.all)
3. Claude API 전달
4. 응답 파싱 → DB 저장
5. 반환

Claude 프롬프트 (prompts/stock-analysis.ts):
- 시스템: "한국 주식 시장 분석 전문가"
- 입력: 재무 요약, 뉴스 5건, 기술적 지표
- 출력 (structured):
  * 강점 3가지
  * 약점 3가지
  * 리스크 요인
  * 종합 의견 (BUY/HOLD/SELL/NEUTRAL)
  * 근거

structured output → jsonb 저장.
프롬프트 토큰 비용 로깅.

통합 테스트도.
```

---

# 세션 C · 백테스팅

> apps/api-backtest (Python FastAPI)
>
> 자연어 전략 → DSL → 시뮬레이션 → 통계

## C-0. 초기 컨텍스트 설정

```
나는 apps/api-backtest만 작업. Python FastAPI 기반.
NestJS apps는 건드리지 마.

책임:
- 자연어 전략 → 구조화 DSL (Claude API)
- DSL → 백테스팅 시뮬레이션
- 통계 결과 반환

기술:
- FastAPI + Pydantic v2
- pandas, numpy, ta-lib
- vectorbt (백테스팅 엔진)
- yfinance / pykrx
- SQLAlchemy 2.0 + asyncpg
- Redis

모듈:
- app/strategies (DSL + 파서)
- app/data (시세 로더 + 캐시)
- app/engine (백테스팅 실행)
- app/api (FastAPI 라우터)
- app/llm (Claude API)

먼저 디렉토리 구조 + 클래스 다이어그램.
```

## C-1. 전략 DSL + 자연어 변환

```
DSL 정의:

{
  "name": "골든크로스",
  "entry": {
    "conditions": [
      {"type": "indicator_crossover", "indicator": "MA",
       "period_short": 5, "period_long": 20, "direction": "above"}
    ]
  },
  "exit": {
    "conditions": [
      {"type": "profit_target", "value": 0.05},
      {"type": "stop_loss", "value": 0.03}
    ],
    "logic": "OR"
  },
  "position_sizing": {"type": "fixed_amount", "value": 1000000}
}

지원 indicator:
- MA, RSI, MACD, Bollinger
- price_above, price_below
- volume_spike

작업:
1. Pydantic 모델 (app/strategies/dsl.py)
2. DSL 검증
3. Claude로 자연어 → DSL (app/llm/strategy_parser.py)
   few-shot examples 포함

엔드포인트:
- POST /strategies/parse { natural_language: "..." } → DSL
- POST /strategies/save { dsl } → DB

자연어 → DSL 정확도 중요. 다양한 입력 테스트.
```

## C-2. 백테스팅 엔진

```
엔드포인트:
- POST /backtest/run
  body: { strategy_id, ticker, period_start, period_end, initial_capital }
  → 작업 ID (비동기)
- GET /backtest/results/:id
- GET /backtest/results/:id/trades

엔진 동작:
1. 시세 로드 (pykrx, Redis 캐시)
2. DSL → vectorbt 시그널
3. 시뮬레이션
4. 메트릭:
   - total_return, annualized_return
   - max_drawdown
   - sharpe_ratio
   - win_rate
   - total_trades
5. 매매 로그 DB 저장

성능:
- 시세 1일 캐싱
- strategy + ticker + period 조합 결과 캐싱
- 10년 30초 이내 목표

비동기:
- BackgroundTasks
- 상태 Redis (PENDING → RUNNING → DONE/FAILED)
- 클라이언트 폴링

테스트:
- 매수후보유 → 지수 수익률 일치
- 골든크로스 합리적 결과
- 엣지: 데이터 없는 종목, 잘못된 기간, 자본 부족
```

---

# Step 2 · 통합 + 프론트엔드

> 세 PR 머지 후 main 브랜치에서.

## 2-1. 게이트웨이 + 인증

```
apps/api-gateway 완성.

해야 할 일:
1. JWT 인증 미들웨어
2. 각 백엔드 프록시 라우팅
3. rate limiting
4. 통합 에러 처리
5. CORS 설정
6. /api/auth/login, /api/auth/register, /api/auth/me

세 백엔드가 정말 동작하는지 점검 후 진행.
```

## 2-2. 프론트엔드 (apps/web)

```
Next.js 14 App Router로 프론트엔드 만들어줘.
중요: 신규 매매 입력 폼은 만들지 않는다. 매매는 텔레그램 봇으로만 들어와.

페이지:
1. /login, /signup : 인증
2. /dashboard : 보유 포지션 + 최근 매매 + 빠른 통계
3. /trades : 매매 목록 (테이블)
   - 인라인 편집 (셀 더블클릭으로 수정)
   - 일괄 선택 → 일괄 편집 모달
   - 빈 reason/emotion 강조 (회고 유도)
   - 필터 (ticker, side, emotion, source, 기간)
4. /trades/missing-context : 회고 전용 페이지
   - 비어있는 reason/emotion 그룹별 표시
   - 한 번에 채우는 워크플로우
5. /trades/import : CSV 업로드
   - 드래그앤드롭
   - 프리뷰 표시 (총/유효/중복/신규)
   - 확정 버튼
6. /reports/:ticker : 분석 리포트
   - 강점/약점/리스크/종합 의견
   - 새로고침 버튼 (24h 캐시)
7. /backtest : 백테스팅
   - 자연어 입력 textarea
   - DSL 미리보기
   - 결과 차트 (Recharts)
   - 수익률, MDD, 승률 카드
8. /coaching : 월간 코칭 리포트
9. /settings/telegram : 텔레그램 봇 연결
   - 6자리 코드 발급
   - "봇에 /link 123456 입력하세요" 안내

UX 원칙:
- 매매 입력 안내는 항상 텔레그램 봇으로 유도
- 대시보드 상단에 "텔레그램으로 매매 기록하기" 배너
- 인라인 편집 위주
- 모바일 반응형 (회고는 PC에서 주로, 입력은 텔레그램)

스타일: Tailwind + shadcn/ui.
```

## 2-3. E2E 테스트 + 배포

```
1. E2E (Playwright):
   시나리오: 로그인 → 텔레그램 연결 → CSV 업로드 → 인라인 편집 →
            분석 리포트 생성 → 백테스팅 → 월간 코칭

2. docker-compose로 전체 시스템 한 번에:
   - postgres, redis
   - api-gateway, api-journal, api-report, api-backtest, telegram-bot
   - web

3. README 업데이트:
   - 셋업 가이드
   - 환경변수 목록
   - 텔레그램 봇 등록 가이드
   - DART/네이버 API 키 발급 가이드
   - 첫 사용 시나리오 (CSV 업로드 → 텔레그램 연결)
```

---

# 개발 순서 권장

신규 입력 폼이 없어진 만큼 기존 6주 → **5주**로 단축.

## 1주차 · 백엔드 기초
- Step 0 사전 작업 (1일)
- 세션 A: A-0, A-1 (CRUD), A-2 (종목 검색)
- 세션 B: B-0, B-1 (외부 API 어댑터)
- 세션 C: C-0, C-1 (DSL 정의)

## 2주차 · 데이터 채우기
- 세션 A: A-3 (CSV 가져오기) ← **이번 주에 본인 과거 매매 데이터 다 넣기**
- 세션 B: B-2 (통합 리포트 생성)
- 세션 C: C-2 (백테스팅 엔진)

→ 2주차 끝나면 본인이 직접 분석 리포트 생성, 백테스팅 가능

## 3주차 · 챗봇 입력
- 세션 A: A-4 (Claude Tool Use 파싱)
- 세션 A: A-5 (종목 매칭 + 확정 흐름)

→ 웹 API로 챗봇 입력 동작 확인

## 4주차 · 텔레그램 봇
- 세션 A: A-6 (텔레그램 봇)
- 통합 시작

→ **이 시점부터 매일 텔레그램으로 매매 기록 시작**

## 5주차 · 통합 + 프론트
- 2-1 (게이트웨이)
- 2-2 (프론트엔드 - 폼 없음, 인라인 편집 중심)
- 세션 A: A-7 (통계 + 코칭)
- 2-3 (E2E + 배포)

## 6주차+ (선택)
- 음성 입력 (텔레그램)
- 카카오톡 챗봇 (OBT 심사 필요)
- KIS API 자동 동기화

---

# 참고 자료

## 비용 추정 (Claude API)

claude-sonnet-4-5 기준:
- input $3/MTok, output $15/MTok
- 매매 파싱 1건: 약 $0.0078 (~11원)
- 하루 5건 가정 시 월 ~1,650원
- prompt caching 적용 시 70% 절감

## 외부 API 키 발급

- DART OpenAPI: https://opendart.fss.or.kr/
- 네이버 검색 API: https://developers.naver.com/
- 한국투자 KIS Developers: https://apiportal.koreainvestment.com/
- Telegram BotFather: 텔레그램에서 @BotFather

## 주요 라이브러리

NestJS:
- @nestjs/common, @nestjs/typeorm, @nestjs/swagger
- class-validator, class-transformer
- @anthropic-ai/sdk
- grammy (텔레그램)
- bullmq (큐)
- ioredis

Python (백테스팅):
- fastapi, pydantic, sqlalchemy, asyncpg
- pandas, numpy, ta-lib
- vectorbt
- pykrx, yfinance
- anthropic
- redis

## 카카오톡 챗봇 추후 도입 시 체크리스트

- 카카오톡 채널 개설 + 비즈니스 인증
- 챗봇 관리자센터(오픈빌더) 봇 생성
- 스킬 서버 webhook (5초 응답 제한 ⚠️)
- 카카오 전용 응답 스키마 (BasicCard, ListCard, QuickReplies)
- OBT 심사 1~2주
- Event API 사용 시 건당 15원

## 트러블슈팅

- git index.lock 에러: `rm -f .git/index.lock`
- 텔레그램 webhook 5초 타임아웃: 비동기 처리 + 즉시 ack
- Claude API rate limit: 재시도 + exponential backoff
- pykrx 데이터 누락: 휴장일 처리, fallback to yfinance

---

작성: 2026-04-27
다음 작업: Step 0-1부터 시작