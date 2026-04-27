from fastapi import APIRouter

router = APIRouter()


@router.post("/parse")
async def parse_strategy(body: dict):
    """자연어 전략 → DSL 변환 (A-C1에서 구현)"""
    raise NotImplementedError


@router.post("/save")
async def save_strategy(body: dict):
    """DSL 저장 (A-C1에서 구현)"""
    raise NotImplementedError
