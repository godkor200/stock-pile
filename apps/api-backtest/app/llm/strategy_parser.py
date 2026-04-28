import json
import logging

import anthropic

from app.core.config import settings
from app.strategies.dsl import StrategyDsl

logger = logging.getLogger(__name__)

_FEW_SHOT_EXAMPLES = [
    {
        "role": "user",
        "content": "5일선이 20일선을 상향돌파하면 사고 5% 수익이나 3% 손실에 팔아. 한 번에 100만원씩.",
    },
    {
        "role": "assistant",
        "content": json.dumps(
            {
                "name": "골든크로스 전략",
                "entry": {
                    "conditions": [
                        {
                            "type": "indicator_crossover",
                            "indicator": "MA",
                            "period_short": 5,
                            "period_long": 20,
                            "direction": "above",
                        }
                    ],
                    "logic": "AND",
                },
                "exit": {
                    "conditions": [
                        {"type": "profit_target", "value": 0.05},
                        {"type": "stop_loss", "value": 0.03},
                    ],
                    "logic": "OR",
                },
                "position_sizing": {"type": "fixed_amount", "value": 1000000},
            },
            ensure_ascii=False,
        ),
    },
    {
        "role": "user",
        "content": "RSI가 30 이하로 떨어지면 매수, 70 이상이면 매도. 자본의 20%씩.",
    },
    {
        "role": "assistant",
        "content": json.dumps(
            {
                "name": "RSI 과매수/과매도 전략",
                "entry": {
                    "conditions": [
                        {
                            "type": "indicator_threshold",
                            "indicator": "RSI",
                            "period": 14,
                            "direction": "below",
                            "value": 30,
                        }
                    ],
                    "logic": "AND",
                },
                "exit": {
                    "conditions": [
                        {
                            "type": "indicator_threshold",
                            "indicator": "RSI",
                            "period": 14,
                            "direction": "above",
                            "value": 70,
                        }
                    ],
                    "logic": "AND",
                },
                "position_sizing": {"type": "percent_capital", "value": 0.2},
            },
            ensure_ascii=False,
        ),
    },
    {
        "role": "user",
        "content": "20일선 위에서 거래량이 평소 2배 이상 터지면 매수, 10% 수익에 매도. 50주씩.",
    },
    {
        "role": "assistant",
        "content": json.dumps(
            {
                "name": "거래량 급증 전략",
                "entry": {
                    "conditions": [
                        {"type": "price_above", "period": 20},
                        {"type": "volume_spike", "value": 2.0},
                    ],
                    "logic": "AND",
                },
                "exit": {
                    "conditions": [{"type": "profit_target", "value": 0.1}],
                    "logic": "OR",
                },
                "position_sizing": {"type": "fixed_shares", "value": 50},
            },
            ensure_ascii=False,
        ),
    },
]

_SYSTEM_PROMPT = """당신은 한국 주식 트레이딩 전략을 구조화된 JSON으로 변환하는 전문가입니다.

반드시 다음 규칙을 따르세요:
- 지원 indicator: MA, RSI, MACD, Bollinger
- 지원 condition type: indicator_crossover, indicator_threshold, price_above, price_below, volume_spike, profit_target, stop_loss
- position_sizing type: fixed_amount(금액), fixed_shares(주수), percent_capital(비율 0~1)
- profit_target, stop_loss의 value는 비율 (5% → 0.05)
- 이동평균 교차는 indicator_crossover + indicator: MA
- 반드시 유효한 JSON만 반환. 설명 텍스트 없음."""


def parse_strategy(natural_language: str) -> StrategyDsl:
    """자연어 전략 문자열을 StrategyDsl로 변환한다."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[
            *_FEW_SHOT_EXAMPLES,
            {"role": "user", "content": natural_language},
        ],
    )

    logger.info(
        "strategy_parser tokens input=%d output=%d",
        response.usage.input_tokens,
        response.usage.output_tokens,
    )

    raw = response.content[0].text.strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude가 유효하지 않은 JSON을 반환했습니다: {e}") from e

    dsl = StrategyDsl.model_validate(data)
    errors = dsl.validate_indicators()
    if errors:
        raise ValueError(f"DSL 검증 실패: {errors}")

    return dsl
