# TASKS.md

현재 작업 상태를 추적한다. 세션 시작 시 CLAUDE.md 다음으로 반드시 읽는다.
태스크 완료 즉시 `[ ]` → `[x]` 로 업데이트한다.

---

## 완료된 태스크

- [x] T-00: 모노레포 파운데이션 (pnpm + Turborepo + 공통 패키지)
- [x] T-01: DB 스키마 및 마이그레이션 (TypeORM entities + pgvector)
- [x] T-02: api-journal 핵심 기능 (trades CRUD, positions, chat CRUD)
- [x] T-03: api-report 핵심 기능 (DART/뉴스/지표 + Ollama RAG)
- [x] T-04: 프론트엔드 MVP (챗 UI + 리포트 페이지)
- [x] T-05: 1차 배포 설정 (docker-compose.prod.yml + Nginx + Oracle Cloud 스크립트)
- [x] T-06: Groq API 채팅 파싱 (llama-3.1-8b-instant, groq/ollama/anthropic 멀티 프로바이더)
- [x] T-07: UsersModule — x-user-id 헤더 기반 UUID 유저 자동 생성
- [x] T-08: TypeORM @JoinColumn 누락 수정 (모든 엔티티 컬럼명 오류 해소)
- [x] T-09: CORS 추가 (api-journal, api-report)
- [x] T-10: .env 경로 수정 — envFilePath: ['.env', '../../.env']
- [x] T-11: VS Code Prettier 저장 시 자동 포맷 설정
- [x] T-12: CLAUDE.md 세션 시작 루틴 추가
- [x] T-22: ChatController FK 위반 수정 — UsersService.findOrCreate를 parse/clarify/confirm 진입 시 호출
- [x] T-23: 챗봇 투자 질문 답변 기능 (2-step pipeline: 의도 분류 → 어드바이저 LLM)

---

## 완료된 태스크 (추가)

- [x] T-24: 이메일 회원가입/로그인 (crypto 내장, POST /auth/signup, /auth/login)
- [x] T-25: CSV 가져오기 nav 임시 비활성화 (주석 처리)

---

## 완료된 태스크 (배포/검증)

- [x] T-13: 브라우저에서 챗봇 E2E 확인 (parse→confirm→trades 저장 검증 완료)
- [x] T-14: `.env.prod` 파일 작성
- [x] T-15: Oracle Cloud 서버 배포 실행
- [x] T-16: Nginx SSL 인증서 설정 (Let's Encrypt)

---

## 진행 중 / 남은 태스크

### 이후 개선 (2차)

- [x] T-17: 챗봇 — 자동 등록 시 Yahoo Finance에서 market(KOSPI/KOSDAQ) 자동 감지
- [x] T-18: 주요 한국 종목 시드 데이터 70개 (packages/db-schema/src/seeds/stocks.seed.ts)
  - 실행: `export $(grep -v '^#' .env | grep -v '^$' | xargs) && pnpm --filter db-schema seed:stocks`

- [x] T-19: api-report 로컬 검증
  - `ANTHROPIC_API_KEY` 또는 Ollama 실행 필요
  - `POST /api/reports` 테스트

- [x] T-20: 월간 코칭 리포트 (api-journal — Claude API 기반 매매 패턴 분석)

- [x] T-21: CSV 일괄 매매 입력 구현 (POST /trades/import-csv, /import 페이지, 템플릿 다운로드)

---

## 메모

---

## 다음 작업 후보

- [ ] T-26: api-backtest 엔진 구현
  - `engine/`, `data/` 빈 디렉토리 채우기 (vectorbt 연동)
  - `POST /backtest/run`, `GET /backtest/results/{id}`, `GET /backtest/results/{id}/trades` NotImplementedError 해소
  - Redis 상태 추적 (PENDING → RUNNING → DONE/FAILED)
  - `/backtest` 웹 페이지 신규 생성 (자연어 전략 입력 → 결과 차트)

- [ ] T-27: 누락 spec 보강
  - api-journal: positions / users / auth 모듈 통합 테스트
  - api-report: llm / vector-store 모듈 테스트

- [x] T-28: 포지션 손익 실시간 표시
  - `GET /positions` 응답에 현재가 기반 미실현 손익(금액, %) 필드 추가
  - yfinance 어댑터는 api-report에 존재 → api-journal에서 재사용 또는 report-client 경유
  - 웹 `/positions` 페이지에 미실현 손익 컬럼 표시
  - 버그 수정: 현재 수익=빨강/손실=파랑으로 색상 반대 → 수익=초록/손실=빨강으로 수정 (page.tsx L51~57)

- [x] T-29: 대시보드 실질화
  - 현재 대시보드는 링크 카드 4개만 있고 실제 데이터 없음
  - 오늘 수익률, 보유 종목 요약 카드 (`GET /positions` 활용)
  - 이번 달 매매 통계 (`GET /trades/stats/quick` 활용)
  - 최근 매매 5건 미니 리스트

---

## 메모

- 마이그레이션 실행 명령 (로컬):
  ```bash
  export $(grep -v '^#' .env | grep -v '^$' | xargs) && pnpm --filter db-schema migration:run
  ```
- `pnpm dev` 전 포트 충돌 자동 해소 (3001/3002/3005)
- Groq API: 무료, https://console.groq.com 에서 발급
