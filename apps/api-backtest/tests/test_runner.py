"""백테스트 엔진 단위 테스트 (네트워크 불필요 — fetch_ohlcv 모킹)."""

from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest

from app.engine.runner import run_backtest
from app.strategies.dsl import (
    ConditionType,
    DslCondition,
    EntryExit,
    IndicatorType,
    PositionSizing,
    StrategyDsl,
)


def _make_ohlcv(n: int = 252, seed: int = 42) -> pd.DataFrame:
    rng = np.random.RandomState(seed)
    dates = pd.date_range("2022-01-01", periods=n, freq="B")
    price = 100.0 * np.cumprod(1 + rng.randn(n) * 0.015)
    high = price * (1 + np.abs(rng.randn(n)) * 0.005)
    low = price * (1 - np.abs(rng.randn(n)) * 0.005)
    volume = rng.randint(100_000, 1_000_000, n).astype(float)
    return pd.DataFrame(
        {"Open": price, "High": high, "Low": low, "Close": price, "Volume": volume},
        index=dates,
    )


_MA_CROSSOVER_DSL = StrategyDsl(
    name="테스트 전략",
    entry=EntryExit(
        conditions=[
            DslCondition(
                type=ConditionType.INDICATOR_CROSSOVER,
                indicator=IndicatorType.MA,
                period_short=5,
                period_long=20,
                direction="above",
            )
        ],
        logic="AND",
    ),
    exit=EntryExit(
        conditions=[
            DslCondition(type=ConditionType.PROFIT_TARGET, value=0.05),
            DslCondition(type=ConditionType.STOP_LOSS, value=0.03),
        ],
        logic="OR",
    ),
    position_sizing=PositionSizing(type="fixed_amount", value=1_000_000),
)

_RSI_DSL = StrategyDsl(
    name="RSI 전략",
    entry=EntryExit(
        conditions=[
            DslCondition(
                type=ConditionType.INDICATOR_THRESHOLD,
                indicator=IndicatorType.RSI,
                period=14,
                direction="below",
                value=30,
            )
        ],
        logic="AND",
    ),
    exit=EntryExit(
        conditions=[
            DslCondition(
                type=ConditionType.INDICATOR_THRESHOLD,
                indicator=IndicatorType.RSI,
                period=14,
                direction="above",
                value=70,
            )
        ],
        logic="AND",
    ),
    position_sizing=PositionSizing(type="percent_capital", value=0.2),
)


@patch("app.engine.runner.fetch_ohlcv")
def test_run_backtest_ma_crossover(mock_fetch):
    mock_fetch.return_value = _make_ohlcv()
    result = run_backtest("TEST", "2022-01-01", "2023-01-01", 10_000_000, _MA_CROSSOVER_DSL)

    assert "metrics" in result
    assert "equity_curve" in result
    assert "trades" in result

    m = result["metrics"]
    assert m["initial_capital"] == 10_000_000
    assert isinstance(m["total_return_pct"], float)
    assert isinstance(m["sharpe_ratio"], float)
    assert 0 <= m["win_rate_pct"] <= 100
    assert m["max_drawdown_pct"] <= 0

    assert len(result["equity_curve"]) > 0
    assert "date" in result["equity_curve"][0]
    assert "value" in result["equity_curve"][0]


@patch("app.engine.runner.fetch_ohlcv")
def test_run_backtest_rsi(mock_fetch):
    mock_fetch.return_value = _make_ohlcv()
    result = run_backtest("TEST", "2022-01-01", "2023-01-01", 10_000_000, _RSI_DSL)

    m = result["metrics"]
    assert m["total_trades"] >= 0
    assert isinstance(m["annual_return_pct"], float)


@patch("app.engine.runner.fetch_ohlcv")
def test_run_backtest_fixed_shares(mock_fetch):
    mock_fetch.return_value = _make_ohlcv()
    dsl = StrategyDsl(
        name="고정주수 전략",
        entry=EntryExit(
            conditions=[DslCondition(type=ConditionType.PRICE_ABOVE, period=10)],
            logic="AND",
        ),
        exit=EntryExit(
            conditions=[DslCondition(type=ConditionType.STOP_LOSS, value=0.05)],
            logic="OR",
        ),
        position_sizing=PositionSizing(type="fixed_shares", value=10),
    )
    result = run_backtest("TEST", "2022-01-01", "2023-01-01", 10_000_000, dsl)
    assert result["metrics"]["initial_capital"] == 10_000_000


@patch("app.engine.runner.fetch_ohlcv")
def test_run_backtest_no_signals(mock_fetch):
    """시그널이 전혀 없어도 에러 없이 빈 거래 반환."""
    df = _make_ohlcv()
    mock_fetch.return_value = df
    # MA(200 vs 300)은 252일 데이터에서 계산 불가 → entries 모두 False
    dsl = StrategyDsl(
        name="신호없음",
        entry=EntryExit(
            conditions=[
                DslCondition(
                    type=ConditionType.INDICATOR_CROSSOVER,
                    indicator=IndicatorType.MA,
                    period_short=200,
                    period_long=300,
                    direction="above",
                )
            ],
            logic="AND",
        ),
        exit=EntryExit(
            conditions=[DslCondition(type=ConditionType.STOP_LOSS, value=0.03)],
            logic="OR",
        ),
        position_sizing=PositionSizing(type="fixed_shares", value=1),
    )
    result = run_backtest("TEST", "2022-01-01", "2023-01-01", 10_000_000, dsl)
    assert result["metrics"]["total_trades"] == 0
    assert len(result["trades"]) == 0
