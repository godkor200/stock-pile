from fastapi import APIRouter

router = APIRouter()


@router.post("/run")
async def run_backtest(body: dict):
    """백테스팅 실행 (C-2에서 구현)"""
    raise NotImplementedError


@router.get("/results/{result_id}")
async def get_result(result_id: str):
    """결과 조회 (C-2에서 구현)"""
    raise NotImplementedError


@router.get("/results/{result_id}/trades")
async def get_trades(result_id: str):
    """매매 로그 (C-2에서 구현)"""
    raise NotImplementedError
