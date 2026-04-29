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

---

## 진행 중 / 남은 태스크

### 로컬 검증

- [ ] T-13: 브라우저에서 챗봇 E2E 확인
  - `pnpm dev` 실행 후 http://localhost:3005/chat 접속
  - "삼성전자 10주 매수" 입력 → READY_TO_CONFIRM 응답 확인
  - 확인 버튼 → trades DB에 저장 확인
  - `.env`에 `GROQ_API_KEY` 입력 필요 (https://console.groq.com)

### 1차 배포 (Oracle Cloud)

- [ ] T-14: `.env.prod` 파일 작성 (`.env.prod.example` 참고)
  - GROQ_API_KEY 필수
  - POSTGRES_PASSWORD 강력한 값으로 변경
  - NEXT_PUBLIC_JOURNAL_URL / NEXT_PUBLIC_REPORT_URL 도메인 설정

- [ ] T-15: Oracle Cloud 서버 접속 후 배포 실행
  ```bash
  git clone <repo> stock-pile && cd stock-pile
  cp .env.prod.example .env.prod  # 값 채우기
  docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
  ```

- [ ] T-16: Nginx SSL 인증서 설정 (Let's Encrypt)
  ```bash
  certbot --nginx -d <도메인>
  ```

### 이후 개선 (2차)

- [ ] T-17: 챗봇 — 종목명만 있고 티커 없을 때 처리 개선
  (현재: STOCK_NOT_FOUND 반환 → 개선안: 종목명으로 DB 퍼지 검색)

- [ ] T-18: 주요 한국 종목 시드 데이터 (KOSPI 200 기본 종목 stocks 테이블 삽입)

- [ ] T-19: api-report 로컬 검증
  - `ANTHROPIC_API_KEY` 또는 Ollama 실행 필요
  - `POST /api/reports` 테스트

- [ ] T-20: 월간 코칭 리포트 (api-journal — Claude API 기반 매매 패턴 분석)

- [ ] T-21: CSV 일괄 매매 입력 구현

---

## 메모

- 마이그레이션 실행 명령 (로컬):
  ```bash
  export $(grep -v '^#' .env | grep -v '^$' | xargs) && pnpm --filter db-schema migration:run
  ```
- `pnpm dev` 전 포트 충돌 자동 해소 (3001/3002/3005)
- Groq API: 무료, https://console.groq.com 에서 발급
