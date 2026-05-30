# api-journal

매매 기록, 포지션, 챗봇 파싱, 월간 코칭을 담당하는 NestJS 서비스.

- **포트**: 3001
- **실행**: `pnpm --filter api-journal dev`
- **테스트**: `pnpm --filter api-journal test -- --testPathPattern=<파일명>`

## 모듈 구조

```
src/
  auth/       — 회원가입/로그인 (crypto 내장, JWT 없음)
  chat/       — 자연어 매매 파싱 (parse → clarify → confirm 멀티턴)
  coaching/   — 월간 매매 패턴 분석 (Claude API)
  positions/  — 보유 포지션 집계
  stocks/     — 종목 검색 및 자동 등록 (Yahoo Finance)
  trades/     — 매매 CRUD + CSV 일괄 입력
  users/      — x-user-id 헤더 기반 사용자 자동 생성
  common/     — Redis 캐시, report-client 어댑터
```

## 주요 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /auth/signup | 회원가입 |
| POST | /auth/login | 로그인 |
| POST | /chat/parse | 자연어 → 매매 파싱 |
| POST | /chat/clarify | 추가 정보 요청 |
| POST | /chat/confirm | 매매 확정 저장 |
| GET | /coaching/monthly | 월간 코칭 리포트 |
| GET | /positions | 보유 포지션 목록 |
| GET | /stocks/search | 종목 검색 |
| GET | /trades | 매매 내역 (페이지네이션) |
| POST | /trades/import-csv | CSV 일괄 입력 |
| PATCH | /trades/:id | 매매 수정 |
| DELETE | /trades/:id | 매매 삭제 |

## 인증 방식

`x-user-id` 헤더로 UUID 전달. Bearer 토큰 아님.  
헤더 없으면 401. 신규 UUID는 `UsersService.findOrCreate`로 자동 생성.

## 외부 의존성

- **Groq API** (`LLM_PROVIDER=groq`, 기본값) — 챗봇 파싱
- **Anthropic Claude API** — 코칭 분석, 폴백 LLM
- **Yahoo Finance** — 종목 시장(KOSPI/KOSDAQ) 자동 감지
- **Redis** — 종목/주가/포지션 캐시
- **api-report** (`http://localhost:3002`) — 리포트 클라이언트

## 테스트 현황

- 완료: `chat-advisor`, `chat-input`, `trades`, `coaching`
- 미작성: `auth`, `positions`, `users`, `stocks` (T-27)

## 주의사항

- 신규 매매 입력 폼 만들지 않음 — 챗봇/CSV 경로만
- 챗봇 확인(confirm) 전 반드시 `UsersService.findOrCreate` 호출 (FK 위반 방지)
- LLM 의도 분류: `TRADE_ENTRY` vs `INVESTMENT_QUERY` 두 갈래로 라우팅
