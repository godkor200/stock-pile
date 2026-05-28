# Bug Investigation and Fix

사용자가 보고한 버그를 분석하고 수정한다.

## 입력

`/bug [에러 메시지 / 스택 트레이스 / 증상 설명]`

## 실행 절차

1. **증상 파악** — 입력된 에러/증상에서 핵심 키워드와 발생 위치를 추출한다.

2. **코드 탐색** — Explore 에이전트로 관련 파일을 찾는다.
   - 에러가 특정 엔드포인트에서 발생했다면 controller → service → repository 순으로 추적
   - 스택 트레이스가 있으면 파일명과 줄 번호로 직접 이동

3. **근본 원인 분석** — 관련 파일을 읽고 실행 경로를 추적한다.
   - TypeORM 관계(`@JoinColumn`, `@ManyToOne`) 누락 여부
   - 비동기 처리(`await`) 누락 여부
   - DTO 검증 미스 여부
   - 외부 API 어댑터의 에러 처리 여부

4. **최소 범위 수정** — 원인이 된 파일만 편집한다. 관련 없는 리팩토링은 하지 않는다.

5. **검증** — 수정 후 관련 테스트를 실행한다.
   ```bash
   pnpm --filter api-journal test -- --testPathPattern=<파일명>
   pnpm --filter api-report test -- --testPathPattern=<파일명>
   ```

6. **보고** — 무엇이 잘못됐고 어떻게 고쳤는지 한 문장으로 요약한다.

## 프로젝트 컨벤션

- `console.log` 금지 → `Logger` 사용
- `any` 타입 금지 → `unknown`으로 좁히기
- 외부 API 호출은 어댑터 패턴으로 감싸야 함 (`apps/*/src/*/adapters/`)
- 스키마 변경 시 마이그레이션 파일 생성 필수 (`packages/db-schema/src/migrations/`)
- 수정 후 새 violations(console.log, any)을 도입하지 않는다
