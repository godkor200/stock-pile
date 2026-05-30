# web

Next.js 14 (App Router) 프론트엔드. api-journal과 api-report를 프록시로 중계한다.

- **포트**: 3005
- **실행**: `pnpm --filter web dev`

## 페이지 목록

| 경로 | 설명 | 백엔드 |
|------|------|--------|
| `/` | `/chat`으로 리다이렉트 | — |
| `/auth` | 로그인/회원가입 | api-journal |
| `/chat` | 자연어 매매 입력 챗봇 | api-journal |
| `/trades` | 거래 내역 (필터/정렬/페이지네이션) | api-journal |
| `/positions` | 보유 포지션 | api-journal |
| `/coaching` | 월간 AI 코칭 리포트 | api-journal |
| `/reports` | 종목 분석 리포트 | api-report |
| `/import` | CSV 일괄 매매 입력 | api-journal |

## API 프록시 구조

Next.js가 백엔드를 직접 노출하지 않고 프록시로 중계:

```
/api/journal/[...path] → JOURNAL_URL (기본값: http://localhost:3001/api)
/api/report/[...path]  → REPORT_URL  (기본값: http://localhost:3002/api)
```

프록시 파일: `src/app/api/journal/[...path]/route.ts`, `src/app/api/report/[...path]/route.ts`

## 인증 흐름

1. `/auth`에서 로그인/가입 → `userId` + `token` 응답
2. `localStorage.sp_user_id`에 userId 저장
3. 모든 API 요청 헤더에 `x-user-id: <userId>` 자동 첨부

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `JOURNAL_URL` | `http://localhost:3001/api` | api-journal 주소 |
| `REPORT_URL` | `http://localhost:3002/api` | api-report 주소 |

## 주요 컴포넌트

- `src/components/AuthGuard.tsx` — 미인증 시 /auth로 리다이렉트
- `src/components/NavLogout.tsx` — 네비게이션 로그아웃
- `src/lib/api.ts` — 공통 fetch 래퍼 (x-user-id 헤더 자동 주입)

## 주의사항

- 신규 매매 입력 폼 만들지 않음 — 챗봇(`/chat`)과 CSV(`/import`) 경로만
- 스타일: Tailwind CSS
- 차트: Recharts
