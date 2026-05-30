# api-gateway

JWT 인증 + 프록시 라우팅을 담당하는 NestJS 게이트웨이. 현재 스켈레톤 상태.

- **포트**: 3000 (`GATEWAY_PORT` 환경변수)
- **실행**: `pnpm --filter api-gateway dev`

## 현재 상태

스켈레톤만 존재. `AuthModule`, `ProxyModule`이 주석 처리된 상태로 실제 기능 미구현.

- ✅ 글로벌 CORS 설정
- ✅ Swagger 문서 (`/docs`)
- ❌ JWT 인증 미들웨어
- ❌ api-journal / api-report / api-backtest 프록시 라우팅

## 현재 프록시 역할

게이트웨이가 미구현이라 **Next.js web 앱이 직접 프록시** 역할 수행 중:
- `/api/journal/*` → api-journal:3001
- `/api/report/*` → api-report:3002

## 향후 구현 계획

게이트웨이를 활성화하면 모든 클라이언트 요청을 단일 진입점(3000)으로 통합:

```
클라이언트 → api-gateway:3000 (JWT 검증)
  ├→ api-journal:3001
  ├→ api-report:3002
  └→ api-backtest:3003
```

## 주의사항

- 현재 실제 서비스에서 사용 안 됨 (web이 직접 api-journal/api-report 호출)
- 활성화 전 `x-user-id` 헤더 기반 인증과 JWT 인증 방식 통합 방안 결정 필요
