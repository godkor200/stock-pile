from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.strategies import router as strategies_router
from app.api.backtest import router as backtest_router
from app.core.config import settings

app = FastAPI(
    title="Stock Pile Backtest API",
    version="0.0.1",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(strategies_router, prefix="/strategies", tags=["strategies"])
app.include_router(backtest_router, prefix="/backtest", tags=["backtest"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "api-backtest"}
