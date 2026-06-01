import logging

import numpy as np
import pandas as pd

from app.data.loader import fetch_ohlcv
from app.engine.indicators import compute_condition_signal
from app.strategies.dsl import ConditionType, StrategyDsl

logger = logging.getLogger(__name__)

COMMISSION = 0.002  # 0.2% 수수료
SLIPPAGE = 0.001    # 0.1% 슬리피지

# vectorbt SizeType 정수 상수 (0.26.x 기준)
_SIZE_AMOUNT = 0   # 주수
_SIZE_VALUE = 1    # 금액
_SIZE_PERCENT = 2  # 자본 비율 (0~1)


def _aggregate_signals(
    df: pd.DataFrame,
    conditions: list,
    logic: str,
) -> pd.Series:
    """조건 목록을 AND/OR 논리로 집계해 불리언 시그널을 반환한다."""
    if not conditions:
        return pd.Series(False, index=df.index)

    if logic == "AND":
        result = pd.Series(True, index=df.index)
        for cond in conditions:
            result = result & compute_condition_signal(df, cond)
    else:  # OR
        result = pd.Series(False, index=df.index)
        for cond in conditions:
            result = result | compute_condition_signal(df, cond)

    return result.fillna(False)


def _extract_stops(conditions: list) -> tuple[float | None, float | None]:
    """조건 목록에서 stop_loss와 profit_target 비율을 추출한다."""
    sl_stop: float | None = None
    tp_stop: float | None = None
    for cond in conditions:
        if cond.type == ConditionType.STOP_LOSS and cond.value:
            sl_stop = float(cond.value)
        elif cond.type == ConditionType.PROFIT_TARGET and cond.value:
            tp_stop = float(cond.value)
    return sl_stop, tp_stop


def run_backtest(
    ticker: str,
    start_date: str,
    end_date: str,
    initial_capital: float,
    dsl: StrategyDsl,
) -> dict:
    """DSL 전략으로 백테스트를 실행하고 결과 딕셔너리를 반환한다.

    Returns:
        {
            "metrics": { total_return_pct, annual_return_pct, sharpe_ratio,
                         max_drawdown_pct, total_trades, win_rate_pct,
                         initial_capital, final_value },
            "equity_curve": [{"date": "YYYY-MM-DD", "value": float}, ...],
            "trades": [{"entry_date", "exit_date", "size", "entry_price",
                        "exit_price", "pnl", "return_pct"}, ...],
        }
    """
    df = fetch_ohlcv(ticker, start_date, end_date)
    close: pd.Series = df["Close"].squeeze()

    # 진입 시그널 (SL/TP는 제외 — vectorbt 파라미터로 처리)
    entry_conds = [
        c for c in dsl.entry.conditions
        if c.type not in (ConditionType.STOP_LOSS, ConditionType.PROFIT_TARGET)
    ]
    entries = _aggregate_signals(df, entry_conds, dsl.entry.logic)

    # 청산 시그널
    sl_stop, tp_stop = _extract_stops(dsl.exit.conditions)
    exit_signal_conds = [
        c for c in dsl.exit.conditions
        if c.type not in (ConditionType.STOP_LOSS, ConditionType.PROFIT_TARGET)
    ]
    exits = _aggregate_signals(df, exit_signal_conds, dsl.exit.logic)

    logger.info(
        "signals: ticker=%s entries=%d exits=%d sl=%s tp=%s",
        ticker, int(entries.sum()), int(exits.sum()), sl_stop, tp_stop,
    )

    # 포지션 사이즈
    sizing = dsl.position_sizing
    if sizing.type == "fixed_shares":
        size, size_type = float(sizing.value), _SIZE_AMOUNT
    elif sizing.type == "fixed_amount":
        size, size_type = float(sizing.value), _SIZE_VALUE
    else:  # percent_capital
        size, size_type = float(sizing.value), _SIZE_PERCENT

    pf_kwargs: dict = dict(
        close=close,
        entries=entries,
        exits=exits,
        init_cash=float(initial_capital),
        fees=COMMISSION,
        slippage=SLIPPAGE,
        size=size,
        size_type=size_type,
        freq="D",
    )
    if sl_stop is not None:
        pf_kwargs["sl_stop"] = sl_stop
    if tp_stop is not None:
        pf_kwargs["tp_stop"] = tp_stop

    import vectorbt as vbt  # lazy import: vectorbt이 plotly 5.x 필요
    pf = vbt.Portfolio.from_signals(**pf_kwargs)

    # 에쿼티 커브 (scalar 보장)
    equity: pd.Series = pf.value()
    if not isinstance(equity, pd.Series):
        equity = pd.Series(equity, index=close.index)
    elif equity.ndim > 1:
        equity = equity.iloc[:, 0]

    final_value = float(equity.iloc[-1])
    total_return = (final_value - initial_capital) / initial_capital

    # 연간 수익률 (복리 기준)
    trading_days = len(equity)
    years = max(trading_days / 252, 0.01)
    annual_return_pct = ((1 + total_return) ** (1 / years) - 1) * 100

    # Sharpe 비율
    daily_rets = equity.pct_change().dropna()
    if len(daily_rets) > 1 and daily_rets.std() > 0:
        sharpe = float(daily_rets.mean() / daily_rets.std() * np.sqrt(252))
    else:
        sharpe = 0.0

    # 최대 낙폭 (%)
    rolling_max = equity.cummax()
    drawdowns = (equity - rolling_max) / rolling_max
    max_drawdown_pct = float(drawdowns.min() * 100)

    # 거래 통계
    total_trades = 0
    win_rate_pct = 0.0
    trades_list: list[dict] = []

    try:
        trade_records = pf.trades.records
        closed = trade_records[trade_records["status"] == 1]  # 청산 완료
        total_trades = len(closed)
        if total_trades > 0:
            win_rate_pct = float((closed["return"] > 0).mean() * 100)

        idx = df.index
        for r in closed:
            entry_idx = int(r["entry_idx"])
            exit_idx = int(r["exit_idx"])
            trades_list.append({
                "entry_date": str(idx[entry_idx].date()),
                "exit_date": str(idx[exit_idx].date()),
                "size": round(float(r["size"]), 4),
                "entry_price": round(float(r["entry_price"]), 2),
                "exit_price": round(float(r["exit_price"]), 2),
                "pnl": round(float(r["pnl"]), 0),
                "return_pct": round(float(r["return"]) * 100, 2),
            })
    except Exception as e:
        logger.warning("거래 로그 파싱 실패: %s", e)

    # 에쿼티 커브 직렬화
    equity_curve = [
        {"date": str(idx.date()), "value": round(float(v), 0)}
        for idx, v in equity.items()
        if not np.isnan(v)
    ]

    return {
        "metrics": {
            "total_return_pct": round(total_return * 100, 2),
            "annual_return_pct": round(annual_return_pct, 2),
            "sharpe_ratio": round(sharpe, 3),
            "max_drawdown_pct": round(max_drawdown_pct, 2),
            "total_trades": total_trades,
            "win_rate_pct": round(win_rate_pct, 1),
            "initial_capital": initial_capital,
            "final_value": round(final_value, 0),
        },
        "equity_curve": equity_curve,
        "trades": trades_list,
    }
