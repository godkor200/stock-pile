export interface OhlcvData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MacdResult {
  value: number;
  signal: number;
  histogram: number;
}

export interface IndicatorSummary {
  ticker: string;
  rsi14: number;
  macd: MacdResult;
  ma: {
    ma5: number;
    ma20: number;
    ma60: number;
  };
  closes30d: number[];
}
