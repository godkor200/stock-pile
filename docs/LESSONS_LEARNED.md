# 시행착오에서 배운 규칙

실제 개발 중 발생한 문제와 해결책. 같은 실수를 반복하지 않기 위해 참조한다.

## TypeORM

**`@ManyToOne`에는 반드시 `@JoinColumn`을 명시한다**
```typescript
// ❌ TypeORM이 컬럼명을 camelCase로 추측해 "userId" 컬럼을 찾으려 함
@ManyToOne(() => UserEntity)
user: UserEntity;

// ✅ 올바름
@ManyToOne(() => UserEntity)
@JoinColumn({ name: 'user_id' })
user: UserEntity;
```

**`@PrimaryGeneratedColumn`도 snake_case 컬럼이면 `name` 옵션 필수**
```typescript
// ❌ DB 컬럼이 session_id인데 TypeORM이 "sessionId"로 INSERT 시도
@PrimaryGeneratedColumn('uuid')
sessionId: string;

// ✅ 올바름
@PrimaryGeneratedColumn('uuid', { name: 'session_id' })
sessionId: string;
```

**QueryBuilder raw string에서는 컬럼명을 직접 사용한다**
```typescript
// ❌ camelCase 프로퍼티명을 그대로 전달하면 PostgreSQL이 인식 못할 수 있음
.where('trade.userId = :userId', { userId })

// ✅ 실제 DB 컬럼명 사용
.where('trade.user_id = :userId', { userId })
```

## NestJS / 모노레포

**`ConfigModule.forRoot`에 `envFilePath`를 반드시 지정한다**

`pnpm dev`(turborepo)는 각 앱 디렉토리를 CWD로 설정해 실행하므로 루트 `.env`를 자동으로 찾지 못한다.
```typescript
ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] })
```

**모든 NestJS 앱에 `enableCors()`를 추가한다**

브라우저에서 다른 포트 API를 호출할 때 CORS 헤더가 없으면 "Failed to fetch"가 발생한다.
```typescript
app.enableCors({ origin: true, credentials: true });
```

**사용자 식별 헤더는 `x-user-id`로 통일한다**

컨트롤러마다 `Authorization: Bearer` / `x-user-id` 혼용 시 일부 엔드포인트만 동작하는 문제가 생긴다.

## Docker / 데이터베이스

**pgvector를 사용하려면 Docker 이미지를 `pgvector/pgvector:pg16`으로 맞춰야 한다**

`postgres:16-alpine`에는 pgvector 확장이 없어 마이그레이션이 실패한다. `docker-compose.yml`과 `docker-compose.prod.yml` 모두 동일한 이미지를 사용한다.

**로컬 마이그레이션 실행 시 반드시 `.env`를 먼저 로드한다**

`typeorm-ts-node-commonjs`는 `.env`를 자동으로 읽지 않는다.
```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs) && pnpm --filter db-schema migration:run
```

## 빌드

**`packages/` 빌드 결과물이 `src/` 안에 섞이면 직접 삭제 후 재빌드한다**

`outDir` 없이 `tsc`를 실행하면 `.js`/`.d.ts` 파일이 `src/`에 생성된다. 정리 방법:
```bash
find packages/shared-types/src packages/db-schema/src \
  -type f \( -name "*.js" -o -name "*.js.map" -o -name "*.d.ts" -o -name "*.d.ts.map" \) -delete
```
