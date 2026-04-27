# 병렬 개발 가이드 (git worktree)

## worktree 생성

Step 0 PR이 main에 머지된 후:

```bash
# 터미널 1 — 투자 일지
git worktree add ../stock-pile-journal feat/journal-a1-a2
cd ../stock-pile-journal
claude

# 터미널 2 — 분석 리포트
git worktree add ../stock-pile-report feat/report-b1
cd ../stock-pile-report
claude

# 터미널 3 — 백테스팅
git worktree add ../stock-pile-backtest feat/backtest-c1
cd ../stock-pile-backtest
claude
```

## 모듈 격리 규칙

| worktree | 수정 가능 | 읽기만 |
|---|---|---|
| stock-pile-journal | `apps/api-journal/`, `apps/telegram-bot/` | `packages/*` |
| stock-pile-report | `apps/api-report/` | `packages/*` |
| stock-pile-backtest | `apps/api-backtest/` | `packages/*` |

- 다른 `apps/` 디렉토리는 절대 수정하지 않는다.
- `packages/shared-types`나 `packages/db-schema` 변경이 필요하면 main에 별도 PR을 먼저 올린다.

## PR 단위 권장

각 세션 스텝 완료 시 PR:

```
PR #2: feat(journal): A-1 trades CRUD + A-2 종목 검색
PR #3: feat(report): B-1 외부 API 어댑터 (DART/News/Indicators)
PR #4: feat(backtest): C-1 전략 DSL + 자연어 변환
PR #5: feat(journal): A-3 CSV 가져오기
PR #6: feat(report): B-2 통합 리포트 생성
PR #7: feat(backtest): C-2 백테스팅 엔진
PR #8: feat(journal): A-4 챗봇 파싱 + A-5 종목 매칭
PR #9: feat(journal): A-6 텔레그램 봇
PR #10: feat(journal): A-7 통계 + 코칭 리포트
PR #11: feat(integration): 게이트웨이 + 프론트엔드 + E2E
```

## 통합 머지 순서

```
packages/shared-types PR → main
  ↓
packages/db-schema PR → main
  ↓
feat/journal-*, feat/report-*, feat/backtest-* (병렬 머지 가능)
  ↓
feat/integration (게이트웨이 + 프론트엔드)
```

## 충돌 대응

1. `packages/shared-types` 충돌 → main 브랜치에서 해결 후 각 worktree `git rebase main`
2. 마이그레이션 타임스탬프 충돌 → 늦게 머지되는 쪽의 타임스탬프를 올린다
3. worktree 삭제: `git worktree remove ../stock-pile-journal`

## 상태 확인

```bash
git worktree list          # 현재 worktree 목록
git branch -a              # 모든 브랜치
```
