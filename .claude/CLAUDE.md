# 프로젝트 규칙

## 작업 범위
- 현재 worktree의 담당 모듈만 수정한다
- `packages/shared-types`, `packages/db-schema`는 읽기 전용 — 변경 필요 시 main 브랜치에 별도 PR
- 다른 `apps/` 디렉토리는 절대 수정하지 않는다

## 입력 인터페이스 원칙
- 신규 매매 입력은 오직 두 경로: 챗봇(자연어) + CSV(일괄)
- 신규 매매 입력 폼은 만들지 않는다 (수정/회고용 인라인 편집만)
- 모든 매매 기록에는 `source` 필드 필수 (`CHATBOT` / `CSV_IMPORT` / `MANUAL_EDIT`)

## 코드 품질
- 모든 public 메서드에 JSDoc/docstring 작성
- 모든 API 엔드포인트에 통합 테스트 작성
- 외부 API 호출은 어댑터로 추상화 (Hexagonal Architecture)
- 에러는 도메인 에러 클래스로 명확히 분류

## DB 규칙
- 스키마 변경 시 반드시 마이그레이션 파일 생성 (`packages/db-schema/src/migrations/`)
- 기존 마이그레이션 파일은 절대 수정하지 않는다

## 커밋 규칙
- conventional commits: `feat` / `fix` / `refactor` / `test` / `docs`
- 한 커밋은 한 가지 변경만
- 커밋 메시지는 한국어 OK

## 에이전트 행동 규칙
- 권한 프롬프트가 발생하면 승인될 때까지 기다린다. 다른 작업으로 전환하거나 스킬을 호출하지 않는다
- 할당된 작업만 수행한다. 작업과 무관한 도구나 스킬은 호출하지 않는다
- 완료 기준: 지정된 파일이 모두 존재하고 테스트가 통과하고 커밋이 완료된 상태

## 금지 사항
- `console.log` 사용 금지 → NestJS `Logger` 또는 Python `logging` 사용
- TypeScript `any` 타입 사용 금지 → `unknown`으로 좁혀쓰기
- 매직 넘버 금지 → 상수로 추출
- 비동기 함수에서 `await` 누락 금지
- 신규 매매 입력 폼 만들지 않기
