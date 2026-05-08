# 개인 투자 어시스턴트를 직접 만들어 봤다 — stock-pile 개발기

> 매매 일지를 엑셀에 쓰다가 지쳐서, AI가 분석해주는 나만의 투자 도구를 만들었다.

서비스 주소: **https://byeongguk.cloud/chat**
프로젝트 저장소: **https://github.com/godkor200/stock-pile**

---

## 왜 만들었나

주식을 오래 하다 보면 자연스럽게 매매 일지를 쓰게 된다. "왜 샀는지", "왜 팔았는지", "그 때 감정은 어땠는지"를 기록해두면 나중에 패턴이 보인다고들 한다.

문제는 **기록하는 게 귀찮다**는 거다.

엑셀을 열고, 날짜 맞추고, 수량 적고, 평균가 계산하고 — 매매 직후 이 과정을 반복하다 보면 어느 날부터 일지 작성을 건너뛰게 된다. 그러면 나중에 몰아서 써야 하는데, 그 때는 이미 감정이 증발해 있다.

게다가 종목 분석도 파편화돼 있었다. DART에서 공시 찾고, 네이버 증권에서 뉴스 보고, 기술지표는 또 다른 사이트에서. 이걸 매번 수동으로 모으는 게 지쳐서, **"한 곳에서 다 처리하는 도구"** 를 만들기로 했다.

---

## 기획 의도

목표는 세 가지였다. 매매 입력은 채팅으로 "삼성전자 10주 매수"라고 치면 바로 기록되게 하고, 종목 분석은 DART 공시·뉴스·기술지표를 AI가 한 번에 종합해주고, 백테스트는 "RSI 30 이하일 때 매수"처럼 자연어로 전략을 검증할 수 있게 하는 것. 이 세 가지를 하나의 서비스로 묶으면 매매 → 분석 → 검증 루프를 한 곳에서 돌릴 수 있겠다고 생각했다.

---

## 기술 스택 선택

### 모노레포 — pnpm + Turborepo

세 개의 독립적인 백엔드(journal, report, backtest)와 프론트엔드를 하나의 레포에서 관리하기 위해 모노레포 구조를 택했다. `packages/shared-types`에 DTO와 열거형을 모아두고 모든 앱에서 임포트하는 방식으로 타입 중복을 막았다. `packages/db-schema`는 TypeORM 엔티티와 마이그레이션만 담당한다.

```
apps/
  web/          # Next.js 14 (App Router)
  api-gateway/  # NestJS, port 3000 — 인증 + 프록시
  api-journal/  # NestJS, port 3001 — 매매 CRUD
  api-report/   # NestJS, port 3002 — AI 분석
  api-backtest/ # Python FastAPI, port 3003 — 전략 엔진
packages/
  shared-types/ # 계약 레이어 (DTO, Enum)
  db-schema/    # TypeORM 엔티티 + 마이그레이션
```

### 백엔드 언어 선택

대부분은 **NestJS + TypeScript**로 갔는데, 백테스트 서비스만 **Python FastAPI**로 분리했다. 이유는 `vectorbt` 때문이다. 파이썬 퀀트 생태계(pandas, numpy, vectorbt)는 TS에서 따라갈 수가 없다. FastAPI를 선택한 건 Pydantic v2의 스키마 검증이 전략 DSL 파싱에 딱 맞아서였다.

### AI 레이어

API 비용과 latency를 모두 고려해서 용도별로 다른 모델을 썼다. 챗봇 매매 파싱처럼 빈번한 요청은 Groq의 `llama-3.1-8b-instant`로 처리한다 — 무료 tier가 넉넉하고 응답이 빠르다. 종목 분석 합성이나 자연어 전략 변환처럼 품질이 중요한 부분에만 Anthropic Claude API를 쓴다.

### DB

PostgreSQL에 `pgvector` 확장을 올렸다. RAG 파이프라인에서 종목 관련 문서 임베딩을 저장하고 검색하기 위해서다. `pgvector/pgvector:pg16` 이미지를 써야 한다는 게 함정이었는데, 처음엔 `postgres:16-alpine`으로 시작했다가 마이그레이션에서 바로 터졌다.

---

## 핵심 기능별 구현 과정

### 챗봇 매매 입력

가장 신경 쓴 부분이다. 처음에는 단순히 LLM에 "이걸 파싱해줘"를 날렸는데, 불명확한 입력("삼성전자 좀 샀어")이 문제였다. 그래서 2-step pipeline으로 구조를 바꿨다. 먼저 의도를 분류해서 매매인지, 투자 질문인지, 추가 정보가 필요한지를 판단한다. 매매로 분류되면 파싱 후 READY_TO_CONFIRM 상태로 사용자 확인을 요청하고, 질문이면 어드바이저 모드로 분기한다. 덕분에 "카카오 어때?"처럼 애매한 입력도 자연스럽게 리포트 생성으로 연결된다.

챗봇 외에 HTS에서 내보낸 CSV 파일을 드래그 앤 드롭하는 일괄 입력도 지원한다. EUC-KR 인코딩 감지가 생각보다 까다로워서 UTF-8 바이트 패턴으로 검증하는 로직을 별도로 짰다. 모든 매매 기록에는 `source` 필드(`CHATBOT` / `CSV_IMPORT` / `MANUAL_EDIT`)를 남겨서 어디서 들어온 데이터인지 추적할 수 있게 했다.

### 종목 분석 리포트

캐시 확인 후 miss가 나면 DART·Naver 뉴스·yfinance를 `Promise.all`로 병렬 호출하고, Claude API로 합성해서 구조화 출력을 DB에 저장한다. 24시간 TTL 캐시는 같은 종목을 하루에 여러 번 조회해도 API를 한 번만 호출하기 위한 비용 절감 장치다.

외부 API는 모두 어댑터 클래스로 감쌌다. 데이터 소스를 교체하거나 테스트에서 mock으로 바꿀 때 도메인 코드를 건드리지 않아도 된다. 분석 결과에는 `Verdict`(매수/중립/매도)가 포함되는데, 종목별 Verdict 변화 이력을 타임라인으로 조회하는 기능도 붙였다. 시간이 지나면서 AI의 판단이 어떻게 바뀌었는지 추적할 수 있다.

### 백테스트

자연어로 전략을 입력하면 Claude가 Pydantic DSL로 변환하고, vectorbt로 시뮬레이션한다. 백테스트는 실행 시간이 길기 때문에 FastAPI `BackgroundTasks`로 비동기 처리하고, 상태(`PENDING → RUNNING → DONE/FAILED`)는 Redis로 관리한다. 클라이언트는 폴링으로 결과를 받아간다.

---

## 개발 타임라인

**4월 27일**에 모노레포 파운데이션, DB 스키마, 세 개 서비스를 동시에 시작했다. git worktree로 각 모듈을 별도 브랜치에서 병렬 개발했다.

**4월 28일**에는 프론트엔드 MVP와 리포트 합성을 구현하고 1차 배포 설정(Docker + Nginx)을 마쳤다.

**4월 29일**은 버그 수정의 날이었다. Groq API를 연동하면서 TypeORM 컬럼명 오류, 모노레포 환경변수 경로 문제를 집중적으로 잡았다. 같은 실수를 반복하지 않으려고 `LESSONS_LEARNED.md` 작성을 시작한 것도 이 날이다.

**5월 6일**에 이메일 인증, 챗봇 투자 어드바이저, 종목명 자동 감지를 올렸다. **5월 7일**에는 Coolify로 HTTPS 배포하고 GitHub Actions CI/CD를 붙였는데, Next.js 빌드가 Oracle Cloud ARM 서버 메모리를 너무 잡아먹어서 프론트엔드만 Vercel로 이관했다. **5월 8일**에는 리포트 이력 조회, 분석 변화 타임라인, CSV 인코딩 개선을 마무리했다.

56 커밋, 약 2주.

---

## 삽질 기록

개발 중 반복하지 않으려고 정리해둔 것들이다.

### Nginx 프록시와 multipart/form-data

CSV 업로드가 게이트웨이를 통해 프록시될 때 `multipart boundary`가 깨졌다. 원인은 response body를 text로 처리하던 것이었고, `arrayBuffer`로 통일하니 해결됐다.

```typescript
// ❌
const body = await response.text();
// ✅
const body = await response.arrayBuffer();
```

### 프론트엔드는 Vercel로 분리했다

처음에 Coolify로 전체 서비스를 올리려 했는데, Next.js 빌드가 Oracle Cloud ARM 서버 메모리를 너무 많이 잡아먹었다. 프론트엔드만 Vercel로 이관하고, Next.js API Route를 프록시로 활용하니 CORS 문제도 함께 해결됐다.

---

## 아키텍처에서 잘한 것들

`shared-types`를 계약 레이어로 쓰는 구조는 생각보다 훨씬 효과적이었다. DTO를 고치면 프론트엔드와 백엔드 전체에서 타입 에러가 바로 잡히기 때문에 런타임 불일치를 거의 경험하지 않았다.

외부 API를 어댑터로 감싼 것도 잘한 판단이었다. DART API가 유량 제한에 걸렸을 때 fallback을 빠르게 붙일 수 있었고, 테스트에서 mock 교체도 깔끔했다.

LLM 프롬프트를 별도 파일(`prompts/`)로 관리한 것도 나중에 빛을 발했다. 인라인 프롬프트였으면 토큰 수정할 때마다 서비스 코드를 건드려야 했을 거다.

---

## LangChain을 써보려는 이유

현재 LLM 관련 코드를 들여다보면 같은 문제가 반복된다. `api-journal`의 `ChatInputService`, `ChatAdvisorService`, `api-report`의 `LlmService` — 세 파일이 각자 Groq / Anthropic / Ollama를 전환하는 동일한 로직을 따로 구현하고 있다. 환경변수 하나로 프로바이더를 바꿀 수 있도록 만들었지만, raw `fetch` 호출, 수동 타임아웃, 응답 파싱까지 세 군데에서 중복된다. 프로바이더가 하나 더 늘어나면 세 파일을 모두 고쳐야 하는 구조다.

JSON 추출 방식도 불안하다. LLM이 반환한 텍스트에서 `text.match(/\{[\s\S]*\}/)` 정규식으로 JSON을 뽑아내는 코드가 여러 곳에 있다. 모델이 마크다운 코드블록으로 감싸거나 설명을 앞에 붙이는 순간 파싱이 조용히 실패한다. 현재는 `emptyParsed()`로 폴백하는데, 이게 맞는 동작인지 확신하기 어렵다.

챗봇 대화 맥락도 아쉽다. 지금은 LLM에 매 호출마다 system + user 메시지만 전달한다. 세션 내 이전 대화는 DB에는 저장되지만 LLM은 매번 첫 번째 대화를 하는 셈이다. "아까 말한 삼성전자 취소해줘"처럼 앞 문맥이 필요한 요청에 답하지 못하는 이유가 여기 있다.

LangChain이 이 세 문제를 동시에 해결할 수 있다. `ChatGroq`, `ChatAnthropic`, `ChatOllama`를 공통 인터페이스로 감싸면 프로바이더 전환은 한 줄로 끝나고, `JsonOutputParser`나 `PydanticOutputParser`를 쓰면 정규식 없이 구조화 출력을 안전하게 뽑을 수 있다. `ConversationBufferWindowMemory`를 붙이면 세션 내 최근 N턴을 LLM 컨텍스트에 포함시킬 수 있다. 의도 분류 → 파싱 → 확인 요청으로 이어지는 2-step 파이프라인도 LCEL(LangChain Expression Language)로 체인으로 선언하면 지금보다 훨씬 읽기 쉬운 코드가 된다.

`api-backtest`의 `strategy_parser.py`는 few-shot 예시가 파일 안에 하드코딩돼 있는데, `FewShotChatMessagePromptTemplate`으로 옮기면 예시 추가·제거가 코드 수정 없이 가능해진다. pgvector와의 RAG 파이프라인도 LangChain의 `PGVector` 스토어가 네이티브로 지원하기 때문에 지금처럼 임베딩 조회를 직접 짜지 않아도 된다.

물론 트레이드오프가 있다. LangChain은 추상화 레이어가 두껍고, 내부에서 무슨 일이 일어나는지 추적하기 어려울 때가 있다. 디버깅하다가 프레임워크 내부로 빠져드는 경우도 흔하다. 그래서 전체를 한 번에 바꾸기보다는 `LlmService`처럼 이미 추상화가 되어 있는 곳부터 조용히 교체해보고, 실제로 코드가 줄어드는지 확인하면서 넓혀나갈 생각이다.

---

## 앞으로 할 일

가장 먼저 할 것은 **LangChain 기반 LLM 레이어 통합**이다. `api-report`의 `LlmService`를 LangChain으로 교체하면서 세 서비스에 흩어진 프로바이더 전환 로직을 하나로 모은다. 이 과정에서 `JsonOutputParser`로 정규식 파싱도 함께 걷어낼 수 있다.

그다음은 **챗봇 대화 메모리**다. 세션 ID 기준으로 `ConversationBufferWindowMemory`를 붙여서 최근 5~10턴을 LLM 컨텍스트에 포함시킨다. "아까 말한 거 취소해줘"나 "그 종목 더 사고 싶어"처럼 문맥이 필요한 요청이 자연스럽게 처리된다.

**월간 코칭 리포트**는 LangChain Agent로 구현할 계획이다. 한 달치 매매 기록을 조회하는 Tool, 평균 수익률을 계산하는 Tool, 보유 포지션을 가져오는 Tool을 Agent에 연결해두면, Claude가 알아서 필요한 데이터를 호출하면서 "당신은 하락장 초입에 추격 매수하는 경향이 있다"처럼 행동 패턴을 분석한 리포트를 만들어낸다. 매매 데이터가 쌓일수록 피드백의 질이 올라가는 구조를 기대하고 있다.

**백테스트 결과 시각화**도 남아 있다. 지금은 시뮬레이션 결과가 JSON으로만 반환되는데, 수익 곡선, 최대 낙폭(MDD), 샤프 비율을 Recharts로 그려주는 대시보드가 필요하다. 전략별로 결과를 비교할 수 있도록 여러 백테스트 결과를 나란히 놓는 뷰도 함께 만들 생각이다.

**텔레그램 봇**은 `apps/telegram-bot` 디렉토리가 이미 만들어져 있다. 모바일에서 브라우저를 열지 않고 텔레그램으로 "삼성전자 10주 매수"를 보내면 바로 기록되는 흐름이다. 챗봇 파이프라인이 이미 있으니 입력 채널만 하나 더 붙이는 작업이라 크게 복잡하지 않을 것 같다.

마지막으로 **배포 안정화**가 남아 있다. 지금은 Oracle Cloud ARM 서버 한 대에 모든 백엔드가 올라가 있다. 트래픽이 없을 때는 문제없지만, 백테스트처럼 CPU를 많이 쓰는 작업이 들어오면 다른 서비스에 영향을 준다. 장기적으로는 `api-backtest`만 분리하거나 작업 큐를 붙이는 걸 고민 중이다.

---

## 마치며

"나만 쓰는 도구"를 만들 때의 자유로움이 있다. 사용자 인터뷰도 없고, PMF도 없고, 그냥 내가 불편한 걸 내가 해결하면 된다.

대신 직접 써보면서 "이건 아닌데"를 느끼는 순간이 많다. 챗봇으로 매매 입력하는 게 처음엔 신기하다가, 실제로 쓰다 보면 확인 단계가 한 번 더 있는 게 귀찮기도 하다. 코드보다 오래 걸린 건 "어떤 정보를 보여줄 때 의사결정에 실제로 도움이 되는가"를 고민하는 시간이었다. 데이터는 많아도 노이즈가 많으면 오히려 판단이 흐려진다.

작은 도구 하나가 투자 루틴을 얼마나 바꿔줄지, 몇 달 더 써봐야 알 것 같다.

---

_스택: NestJS · Next.js · Python FastAPI · PostgreSQL/pgvector · Redis · Anthropic Claude · Groq · Turborepo · Docker · Vercel · Coolify_

_GitHub: https://github.com/godkor200/stock-pile_
