import logging

import pandas as pd
from ta.momentum import RSIIndicator

from app.strategies.dsl import ConditionType, DslCondition, IndicatorType

logger = logging.getLogger(__name__)


def compute_condition_signal(df: pd.DataFrame, cond: DslCondition) -> pd.Series:
    """DSL 조건 하나를 불리언 시그널 Series로 변환한다.

    profit_target / stop_loss 조건은 vectorbt가 직접 처리하므로 False를 반환한다.
    """
    close: pd.Series = df["Close"].squeeze()
    volume: pd.Series = df["Volume"].squeeze()

    if cond.type == ConditionType.INDICATOR_CROSSOVER:
        return _crossover_signal(close, cond)
    elif cond.type == ConditionType.INDICATOR_THRESHOLD:
        return _threshold_signal(close, cond)
    elif cond.type == ConditionType.PRICE_ABOVE:
        period = cond.period or 20
        ma = close.rolling(period).mean()
        return (close > ma).fillna(False)
    elif cond.type == ConditionType.PRICE_BELOW:
        period = cond.period or 20
        ma = close.rolling(period).mean()
        return (close < ma).fillna(False)
    elif cond.type == ConditionType.VOLUME_SPIKE:
        threshold = cond.value or 2.0
        avg_vol = volume.rolling(20).mean()
        return (volume > avg_vol * threshold).fillna(False)
    else:
        # PROFIT_TARGET / STOP_LOSS → vectorbt 파라미터로 처리
        return pd.Series(False, index=df.index)


def _crossover_signal(close: pd.Series, cond: DslCondition) -> pd.Series:
    """이동평균 교차 시그널."""
    short_ma = close.rolling(cond.period_short).mean()
    long_ma = close.rolling(cond.period_long).mean()
    if cond.direction == "above":
        cross = (short_ma > long_ma) & (short_ma.shift(1) <= long_ma.shift(1))
    else:
        cross = (short_ma < long_ma) & (short_ma.shift(1) >= long_ma.shift(1))
    return cross.fillna(False)


def _threshold_signal(close: pd.Series, cond: DslCondition) -> pd.Series:
    """지표 임계값 시그널 (RSI, MA 기반)."""
    if cond.indicator == IndicatorType.RSI:
        period = cond.period or 14
        rsi = RSIIndicator(close, window=period).rsi()
        if cond.direction == "below":
            return (rsi < (cond.value or 30)).fillna(False)
        else:
            return (rsi > (cond.value or 70)).fillna(False)
    elif cond.indicator == IndicatorType.MA:
        period = cond.period or 20
        ma = close.rolling(period).mean()
        if cond.direction == "above":
            return (close > ma).fillna(False)
        else:
            return (close < ma).fillna(False)
    else:
        logger.warning("unsupported indicator for threshold: %s", cond.indicator)
        return pd.Series(False, index=close.index)
