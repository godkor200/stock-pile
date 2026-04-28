from enum import Enum
from typing import Literal
from pydantic import BaseModel, field_validator


class IndicatorType(str, Enum):
    MA = "MA"
    RSI = "RSI"
    MACD = "MACD"
    BOLLINGER = "Bollinger"


class ConditionType(str, Enum):
    INDICATOR_CROSSOVER = "indicator_crossover"
    INDICATOR_THRESHOLD = "indicator_threshold"
    PRICE_ABOVE = "price_above"
    PRICE_BELOW = "price_below"
    VOLUME_SPIKE = "volume_spike"
    PROFIT_TARGET = "profit_target"
    STOP_LOSS = "stop_loss"


class DslCondition(BaseModel):
    type: ConditionType
    indicator: IndicatorType | None = None
    period_short: int | None = None
    period_long: int | None = None
    period: int | None = None
    direction: Literal["above", "below"] | None = None
    value: float | None = None

    @field_validator("period_short", "period_long", "period")
    @classmethod
    def must_be_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("period must be positive")
        return v


class EntryExit(BaseModel):
    conditions: list[DslCondition]
    logic: Literal["AND", "OR"] = "AND"


class PositionSizing(BaseModel):
    type: Literal["fixed_amount", "fixed_shares", "percent_capital"]
    value: float


class StrategyDsl(BaseModel):
    name: str
    entry: EntryExit
    exit: EntryExit
    position_sizing: PositionSizing

    def validate_indicators(self) -> list[str]:
        """지원하지 않는 조합 검증. 오류 목록 반환."""
        errors: list[str] = []
        all_conditions = self.entry.conditions + self.exit.conditions
        for cond in all_conditions:
            if cond.type == ConditionType.INDICATOR_CROSSOVER:
                if cond.indicator != IndicatorType.MA:
                    errors.append(
                        f"crossover only supported for MA, got {cond.indicator}"
                    )
                if not cond.period_short or not cond.period_long:
                    errors.append("crossover requires period_short and period_long")
                elif cond.period_short >= cond.period_long:
                    errors.append("period_short must be less than period_long")
        return errors
