# api-backtest

자연어 투자 전략을 DSL로 변환하고 vectorbt로 백테스트를 실행하는 Python FastAPI 서비스.

- **포트**: 3003
- **실행**:
  ```bash
  cd apps/api-backtest
  source .venv/bin/activate  # python -m venv .venv && pip install -r requirements.txt
  uvicorn app.main:app --reload --port 3003
  ```
- **테스트**: `pytest`

## 디렉토리 구조

```
app/
  api/          — 엔드포인트 (backtest.py, strategies.py)
  strategies/   — DSL 클래스 (dsl.py)
  llm/          — 자연어 파싱 (strategy_parser.py, Anthropic SDK)
  engine/       — 백테스트 실행 엔진 (미구현 — T-26)
  data/         — 시세 데이터 로더 (미구현 — T-26)
  core/         — 설정 (config.py)
tests/
```

## 엔드포인트 현황

| 메서드 | 경로 | 상태 |
|--------|------|------|
| POST | /strategies/parse | ✅ 구현 — 자연어 → DSL JSON |
| POST | /strategies/save | ✅ 구현 |
| POST | /backtest/run | ❌ NotImplementedError (T-26) |
| GET | /backtest/results/{id} | ❌ NotImplementedError (T-26) |
| GET | /backtest/results/{id}/trades | ❌ NotImplementedError (T-26) |

## 핵심 파일

- `app/strategies/dsl.py` — `StrategyDsl`, `IndicatorType`(MA/RSI/MACD/Bollinger), `ConditionType` Pydantic 모델
- `app/llm/strategy_parser.py` — Anthropic SDK + Few-shot 프롬프팅 → DSL JSON 생성

## T-26 구현 계획

- `app/data/` — yfinance로 OHLCV 데이터 로더
- `app/engine/` — DSL → vectorbt 시뮬레이션 실행
- Redis 상태 추적: `PENDING → RUNNING → DONE/FAILED`
- `/backtest` 웹 페이지 연동

## 주의사항

- Python 전용, pnpm workspace 외부 — `pnpm dev`에 포함 안 됨
- Pydantic v2 사용
- 외부 API 호출은 어댑터 패턴으로 추상화
