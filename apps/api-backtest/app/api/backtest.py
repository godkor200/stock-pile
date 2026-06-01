import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, model_validator

from app.core.config import settings
from app.engine.runner import run_backtest
from app.llm.strategy_parser import parse_strategy
from app.strategies.dsl import StrategyDsl

router = APIRouter()
logger = logging.getLogger(__name__)

_RESULT_TTL = 86_400  # 24시간


class RunBacktestRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    initial_capital: float = 10_000_000
    natural_language: str | None = None
    strategy: StrategyDsl | None = None

    @model_validator(mode="after")
    def validate_strategy_source(self) -> "RunBacktestRequest":
        if not self.natural_language and not self.strategy:
            raise ValueError("natural_language 또는 strategy 중 하나는 필수입니다")
        return self


def _redis() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def _set_state(redis: aioredis.Redis, key: str, data: dict) -> None:
    await redis.setex(key, _RESULT_TTL, json.dumps(data, ensure_ascii=False))


async def _execute_backtest(result_id: str, req: RunBacktestRequest) -> None:
    """백테스트를 백그라운드에서 실행하고 Redis에 결과를 저장한다."""
    redis = _redis()
    key = f"backtest:{result_id}"

    try:
        # RUNNING 상태 기록
        raw = await redis.get(key)
        state = json.loads(raw) if raw else {}
        state["status"] = "RUNNING"
        await _set_state(redis, key, state)

        # 전략 파싱 (자연어 입력인 경우)
        if req.natural_language:
            dsl = await asyncio.to_thread(parse_strategy, req.natural_language)
        else:
            dsl = req.strategy  # type: ignore[assignment]

        state["strategy_name"] = dsl.name

        # 백테스트 실행
        result = await asyncio.to_thread(
            run_backtest,
            req.ticker,
            req.start_date,
            req.end_date,
            req.initial_capital,
            dsl,
        )

        # 거래 로그는 별도 키에 저장 (메인 키 크기 절약)
        trades_key = f"backtest:{result_id}:trades"
        await redis.setex(trades_key, _RESULT_TTL, json.dumps(result["trades"], ensure_ascii=False))

        state.update({
            "status": "DONE",
            "metrics": result["metrics"],
            "equity_curve": result["equity_curve"],
        })
        await _set_state(redis, key, state)

        logger.info("backtest done: id=%s trades=%d", result_id, result["metrics"]["total_trades"])

    except Exception as exc:
        logger.exception("backtest failed: id=%s", result_id)
        try:
            raw = await redis.get(key)
            state = json.loads(raw) if raw else {}
            state.update({"status": "FAILED", "error": str(exc)})
            await _set_state(redis, key, state)
        except Exception:
            pass
    finally:
        await redis.aclose()


@router.post("/run", summary="백테스트 실행")
async def run_backtest_endpoint(
    body: RunBacktestRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    """자연어 전략 또는 DSL을 받아 백테스트를 비동기로 실행한다.

    응답으로 result_id를 즉시 반환하고, 클라이언트는 GET /backtest/results/{id}를 폴링한다.
    """
    result_id = str(uuid.uuid4())
    redis = _redis()

    initial_state = {
        "id": result_id,
        "status": "PENDING",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "ticker": body.ticker,
        "strategy_name": (
            (body.natural_language or "")[:50]
            if body.natural_language
            else (body.strategy.name if body.strategy else "")
        ),
    }

    await _set_state(redis, f"backtest:{result_id}", initial_state)
    await redis.aclose()

    background_tasks.add_task(_execute_backtest, result_id, body)
    return {"id": result_id, "status": "PENDING"}


@router.get("/results/{result_id}", summary="백테스트 결과 조회")
async def get_result(result_id: str) -> dict:
    """백테스트 결과를 조회한다. status가 DONE이면 metrics와 equity_curve를 포함한다."""
    redis = _redis()
    raw = await redis.get(f"backtest:{result_id}")
    await redis.aclose()

    if not raw:
        raise HTTPException(status_code=404, detail="결과를 찾을 수 없습니다")
    return json.loads(raw)


@router.get("/results/{result_id}/trades", summary="백테스트 거래 로그 조회")
async def get_trades(result_id: str) -> list:
    """백테스트의 개별 거래 내역을 반환한다."""
    redis = _redis()
    raw = await redis.get(f"backtest:{result_id}:trades")
    await redis.aclose()

    if not raw:
        raise HTTPException(status_code=404, detail="거래 내역을 찾을 수 없습니다")
    return json.loads(raw)
