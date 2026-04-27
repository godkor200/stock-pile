import json
import logging
from unittest.mock import MagicMock, patch

import pytest

from app.strategies.dsl import StrategyDsl

_GOLDEN_CROSS = {
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
}

_RSI_STRATEGY = {
    "name": "RSI 전략",
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
}


@pytest.fixture
def mock_anthropic_client():
    with patch("app.llm.strategy_parser.anthropic.Anthropic") as mock_cls:
        instance = MagicMock()
        mock_cls.return_value = instance
        yield instance


def _make_response(dsl_dict: dict) -> MagicMock:
    response = MagicMock()
    response.content = [MagicMock(text=json.dumps(dsl_dict, ensure_ascii=False))]
    response.usage = MagicMock(input_tokens=120, output_tokens=80)
    return response


def test_parse_golden_cross(mock_anthropic_client):
    mock_anthropic_client.messages.create.return_value = _make_response(_GOLDEN_CROSS)

    from app.llm.strategy_parser import parse_strategy

    dsl = parse_strategy("5일선이 20일선을 상향돌파하면 사고 5% 수익이나 3% 손실에 팔아")

    assert isinstance(dsl, StrategyDsl)
    assert dsl.entry.conditions[0].period_short == 5
    assert dsl.entry.conditions[0].period_long == 20
    assert dsl.validate_indicators() == []


def test_parse_rsi_strategy(mock_anthropic_client):
    mock_anthropic_client.messages.create.return_value = _make_response(_RSI_STRATEGY)

    from app.llm.strategy_parser import parse_strategy

    dsl = parse_strategy("RSI가 30 이하면 매수, 70 이상이면 매도")

    assert dsl.entry.conditions[0].value == 30
    assert dsl.exit.conditions[0].value == 70


def test_invalid_json_raises_value_error(mock_anthropic_client):
    response = MagicMock()
    response.content = [MagicMock(text="이건 JSON이 아닙니다")]
    response.usage = MagicMock(input_tokens=50, output_tokens=10)
    mock_anthropic_client.messages.create.return_value = response

    from app.llm.strategy_parser import parse_strategy

    with pytest.raises(ValueError, match="유효하지 않은 JSON"):
        parse_strategy("아무 전략")


def test_token_usage_logged(mock_anthropic_client, caplog):
    mock_anthropic_client.messages.create.return_value = _make_response(_GOLDEN_CROSS)

    from app.llm.strategy_parser import parse_strategy

    with caplog.at_level(logging.INFO, logger="app.llm.strategy_parser"):
        parse_strategy("골든크로스 전략")

    assert "input=120" in caplog.text
    assert "output=80" in caplog.text
