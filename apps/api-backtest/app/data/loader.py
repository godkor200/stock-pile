import logging

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)


def fetch_ohlcv(ticker: str, start: str, end: str) -> pd.DataFrame:
    """yfinance로 OHLCV 데이터를 가져온다.

    Args:
        ticker: 종목 코드 (예: "005930.KS", "AAPL")
        start: 시작일 "YYYY-MM-DD"
        end: 종료일 "YYYY-MM-DD"

    Returns:
        Open, High, Low, Close, Volume 컬럼을 가진 DataFrame (DatetimeIndex)

    Raises:
        ValueError: 데이터를 찾을 수 없거나 기간이 너무 짧은 경우
    """
    logger.info("fetching OHLCV: ticker=%s start=%s end=%s", ticker, start, end)
    df = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=True)

    if df.empty:
        raise ValueError(f"'{ticker}' 데이터를 찾을 수 없습니다. 종목 코드를 확인하세요.")

    # multi-level 컬럼 정리
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()

    if len(df) < 30:
        raise ValueError(
            f"'{ticker}' 데이터가 30일 미만입니다 ({len(df)}일). 기간을 늘려주세요."
        )

    logger.info("fetched %d rows for %s", len(df), ticker)
    return df
