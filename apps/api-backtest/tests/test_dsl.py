import pytest
from pydantic import ValidationError

from app.strategies.dsl import (
    ConditionType,
    DslCondition,
    EntryExit,
    IndicatorType,
    PositionSizing,
    StrategyDsl,
)


def _golden_cross_dsl() -> StrategyDsl:
    return StrategyDsl(
        name="골든크로스",
        entry=EntryExit(
            conditions=[
                DslCondition(
                    type=ConditionType.INDICATOR_CROSSOVER,
                    indicator=IndicatorType.MA,
                    period_short=5,
                    period_long=20,
                    direction="above",
                )
            ]
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


def test_golden_cross_dsl_valid():
    dsl = _golden_cross_dsl()
    assert dsl.validate_indicators() == []


def test_rsi_dsl_valid():
    dsl = StrategyDsl(
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
            ]
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
            ]
        ),
        position_sizing=PositionSizing(type="percent_capital", value=0.2),
    )
    assert dsl.validate_indicators() == []


def test_invalid_period_short_greater_than_long():
    dsl = StrategyDsl(
        name="잘못된 크로스",
        entry=EntryExit(
            conditions=[
                DslCondition(
                    type=ConditionType.INDICATOR_CROSSOVER,
                    indicator=IndicatorType.MA,
                    period_short=20,
                    period_long=5,
                    direction="above",
                )
            ]
        ),
        exit=EntryExit(
            conditions=[DslCondition(type=ConditionType.PROFIT_TARGET, value=0.05)]
        ),
        position_sizing=PositionSizing(type="fixed_amount", value=500_000),
    )
    errors = dsl.validate_indicators()
    assert any("period_short must be less than period_long" in e for e in errors)


def test_negative_period_raises():
    with pytest.raises(ValidationError):
        DslCondition(type=ConditionType.INDICATOR_THRESHOLD, period=-1)


def test_zero_period_raises():
    with pytest.raises(ValidationError):
        DslCondition(type=ConditionType.INDICATOR_THRESHOLD, period=0)


def test_crossover_missing_periods():
    dsl = StrategyDsl(
        name="기간 누락",
        entry=EntryExit(
            conditions=[
                DslCondition(
                    type=ConditionType.INDICATOR_CROSSOVER,
                    indicator=IndicatorType.MA,
                    direction="above",
                    # period_short, period_long 누락
                )
            ]
        ),
        exit=EntryExit(
            conditions=[DslCondition(type=ConditionType.PROFIT_TARGET, value=0.05)]
        ),
        position_sizing=PositionSizing(type="fixed_amount", value=500_000),
    )
    errors = dsl.validate_indicators()
    assert any("period_short and period_long" in e for e in errors)


def test_crossover_non_ma_indicator():
    dsl = StrategyDsl(
        name="RSI 크로스 (미지원)",
        entry=EntryExit(
            conditions=[
                DslCondition(
                    type=ConditionType.INDICATOR_CROSSOVER,
                    indicator=IndicatorType.RSI,
                    period_short=5,
                    period_long=14,
                    direction="above",
                )
            ]
        ),
        exit=EntryExit(
            conditions=[DslCondition(type=ConditionType.PROFIT_TARGET, value=0.05)]
        ),
        position_sizing=PositionSizing(type="fixed_shares", value=10),
    )
    errors = dsl.validate_indicators()
    assert any("crossover only supported for MA" in e for e in errors)
