# api-report

종목 분석 리포트 생성을 담당하는 NestJS 서비스.  
DART 공시 + Naver 뉴스 + 기술 지표를 수집해 Claude API로 합성 후 저장.

- **포트**: 3002
- **실행**: `pnpm --filter api-report dev`
- **테스트**: `pnpm --filter api-report test -- --testPathPattern=<파일명>`

## 모듈 구조

```
src/
  reports/    — 리포트 생성/조회 (24h TTL 캐시)
  dart/       — 금융감독원 공시/재무제표 어댑터
  news/       — Naver 뉴스 검색 어댑터
  indicators/ — 기술 지표 + Yahoo Finance 주가
  llm/        — LLM 추상화 (anthropic/groq/ollama 동적 전환)
  vector/     — pgvector 임베딩 저장소
  common/     — Redis 캐시
```

## 주요 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /reports | 리포트 생성 (body: `{ ticker }`) |
| GET | /reports | 사용자 리포트 목록 (종목별 최신 1개) |
| GET | /reports/:ticker/history | 특정 종목 리포트 이력 (최대 20개) |

## 리포트 생성 흐름

1. DB 캐시 확인 (24h TTL, 동일 userId + ticker)
2. `Promise.all([DART 공시, Naver 뉴스, 기술 지표])` 병렬 수집
3. Claude API → 구조화 분석 (`verdict`, `summary`, `strengths`, `weaknesses`, `riskFactors`)
4. DB 저장 후 반환

`claudeAnalysis` 필드는 `JSON.stringify`된 문자열로 저장됨 — 조회 시 파싱 필요.

## 인증 방식

`x-user-id` 헤더 필수 (api-journal과 동일).

## 외부 의존성

- **Anthropic Claude API** — 리포트 합성 (기본값)
- **Groq API** — Anthropic 미설정 시 폴백
- **DART API** (`DART_API_KEY`) — 공시/재무제표, 없으면 빈 배열로 진행
- **Naver API** (`NAVER_CLIENT_ID/SECRET`) — 뉴스, 없으면 빈 배열
- **Yahoo Finance** — 주가/기술 지표
- **Redis** — DART/뉴스/지표 24h 캐시

## 테스트 현황

- 완료: `dart`, `news`, `indicators`, `reports`
- 미작성: `llm`, `vector` (T-27)

## 주의사항

- LLM 프로바이더는 `LLM_PROVIDER` 환경변수로 전환 (`anthropic` / `groq` / `ollama`)
- DART/Naver 키 없어도 리포트 생성 가능 (해당 섹션 빈 배열)
- 외부 API 실패는 try/catch로 흡수 — 전체 요청 실패로 전파 안 됨
