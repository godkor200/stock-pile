"""백테스트 API 엔드포인트 통합 테스트."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_VALID_REQUEST = {
    "ticker": "005930.KS",
    "start_date": "2023-01-01",
    "end_date": "2024-01-01",
    "initial_capital": 10_000_000,
    "natural_language": "5일선이 20일선을 상향돌파하면 매수, 5% 수익이나 3% 손실에 매도",
}

_MOCK_RESULT = {
    "id": "test-id",
    "status": "DONE",
    "ticker": "005930.KS",
    "strategy_name": "골든크로스 전략",
    "metrics": {
        "total_return_pct": 12.5,
        "annual_return_pct": 13.1,
        "sharpe_ratio": 0.85,
        "max_drawdown_pct": -8.2,
        "total_trades": 10,
        "win_rate_pct": 60.0,
        "initial_capital": 10_000_000,
        "final_value": 11_250_000,
    },
    "equity_curve": [{"date": "2023-01-02", "value": 10_000_000}],
}


def test_run_backtest_missing_strategy():
    """strategy도 natural_language도 없으면 422 반환."""
    res = client.post(
        "/backtest/run",
        json={
            "ticker": "005930.KS",
            "start_date": "2023-01-01",
            "end_date": "2024-01-01",
        },
    )
    assert res.status_code == 422


@patch("app.api.backtest._redis")
def test_run_backtest_returns_pending(mock_redis_factory):
    """POST /backtest/run은 즉시 PENDING 상태를 반환한다."""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.setex.return_value = True
    mock_redis.aclose.return_value = None
    mock_redis_factory.return_value = mock_redis

    res = client.post("/backtest/run", json=_VALID_REQUEST)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PENDING"
    assert "id" in data


@patch("app.api.backtest._redis")
def test_get_result_not_found(mock_redis_factory):
    """존재하지 않는 result_id는 404를 반환한다."""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.aclose.return_value = None
    mock_redis_factory.return_value = mock_redis

    res = client.get("/backtest/results/nonexistent-id")
    assert res.status_code == 404


@patch("app.api.backtest._redis")
def test_get_result_done(mock_redis_factory):
    """DONE 상태의 결과에는 metrics와 equity_curve가 포함된다."""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = json.dumps(_MOCK_RESULT)
    mock_redis.aclose.return_value = None
    mock_redis_factory.return_value = mock_redis

    res = client.get("/backtest/results/test-id")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "DONE"
    assert "metrics" in data
    assert data["metrics"]["total_return_pct"] == 12.5


@patch("app.api.backtest._redis")
def test_get_trades_not_found(mock_redis_factory):
    """거래 로그가 없으면 404를 반환한다."""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.aclose.return_value = None
    mock_redis_factory.return_value = mock_redis

    res = client.get("/backtest/results/test-id/trades")
    assert res.status_code == 404


@patch("app.api.backtest._redis")
def test_get_trades_success(mock_redis_factory):
    """거래 로그가 있으면 리스트를 반환한다."""
    mock_trades = [
        {
            "entry_date": "2023-01-10",
            "exit_date": "2023-01-20",
            "size": 10.0,
            "entry_price": 60000.0,
            "exit_price": 63000.0,
            "pnl": 30000.0,
            "return_pct": 5.0,
        }
    ]
    mock_redis = AsyncMock()
    mock_redis.get.return_value = json.dumps(mock_trades)
    mock_redis.aclose.return_value = None
    mock_redis_factory.return_value = mock_redis

    res = client.get("/backtest/results/test-id/trades")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert data[0]["pnl"] == 30000.0
