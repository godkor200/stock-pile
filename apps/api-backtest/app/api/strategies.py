import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.llm.strategy_parser import parse_strategy
from app.strategies.dsl import StrategyDsl

router = APIRouter()


class ParseRequest(BaseModel):
    natural_language: str


class ParseResponse(BaseModel):
    dsl: StrategyDsl
    validation_errors: list[str]


@router.post("/parse", response_model=ParseResponse)
async def parse_strategy_endpoint(body: ParseRequest) -> ParseResponse:
    """자연어 전략 → DSL 변환"""
    try:
        dsl = await asyncio.to_thread(parse_strategy, body.natural_language)
        return ParseResponse(dsl=dsl, validation_errors=[])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="전략 파싱에 실패했습니다") from e


@router.post("/save")
async def save_strategy_endpoint(dsl: StrategyDsl) -> dict:
    """DSL 저장 (C-2에서 DB 연동 구현)"""
    errors = dsl.validate_indicators()
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    return {"status": "ok", "dsl": dsl.model_dump()}
