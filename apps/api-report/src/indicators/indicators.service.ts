import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as ti from 'technicalindicators';
import { RedisCacheService } from '../common/redis-cache.service';
import {
  OhlcvData,
  IndicatorSummary,
  MacdResult,
} from './interfaces/ohlcv.interface';

const CACHE_TTL = 3600;
const YAHOO_BASE = 'https://query1.finance.yahoo.com';

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: { symbol: string; shortName?: string; longName?: string };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
      };
    }> | null;
    error: unknown;
  };
}

@Injectable()
export class IndicatorsService {
  private readonly logger = new Logger(IndicatorsService.name);

  constructor(private readonly cache: RedisCacheService) {}

  /**
   * Yahoo Finance에서 종목명을 조회한다. 실패 시 null 반환.
   * KOSDAQ 종목은 .KS 실패 후 .KQ로 재시도한다.
   */
  async fetchStockName(ticker: string): Promise<string | null> {
    const symbols = /^\d{6}$/.test(ticker)
      ? [`${ticker}.KS`, `${ticker}.KQ`]
      : [ticker];

    for (const symbol of symbols) {
      try {
        const { data } = await axios.get<YahooChartResponse>(
          `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}`,
          { params: { interval: '1d', range: '1d' }, timeout: 8000 },
        );
        const meta = data?.chart?.result?.[0]?.meta;
        const name = meta?.shortName ?? meta?.longName ?? null;
        if (name) return name;
      } catch {
        // 다음 심볼 시도
      }
    }
    return null;
  }

  private buildYahooSymbol(ticker: string): string {
    // Korean stocks need .KS suffix; NASDAQ tickers kept as-is
    // Heuristic: if ticker is 6-digit numeric string, it's Korean
    if (/^\d{6}$/.test(ticker)) {
      return `${ticker}.KS`;
    }
    return ticker;
  }

  async getOhlcv(ticker: string, days: number): Promise<OhlcvData[]> {
    const key = `indicators:ohlcv:${ticker}:${days}`;
    const cached = await this.cache.get<OhlcvData[]>(key);
    if (cached !== null) {
      this.logger.debug(`Cache hit: ${key}`);
      return cached;
    }

    try {
      const symbol = this.buildYahooSymbol(ticker);
      const { data } = await axios.get<YahooChartResponse>(
        `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}`,
        {
          params: {
            interval: '1d',
            range: `${days}d`,
          },
          timeout: 10000,
        },
      );

      const result = data?.chart?.result?.[0];
      if (!result) return [];

      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];

      const ohlcvList: OhlcvData[] = timestamps
        .map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          open: quote.open[i] ?? 0,
          high: quote.high[i] ?? 0,
          low: quote.low[i] ?? 0,
          close: quote.close[i] ?? 0,
          volume: quote.volume[i] ?? 0,
        }))
        .filter((d) => d.close > 0);

      await this.cache.set(key, ohlcvList, CACHE_TTL);
      return ohlcvList;
    } catch (err) {
      this.logger.error(`getOhlcv failed for ticker=${ticker}`, err);
      return [];
    }
  }

  calculateRsi(closes: number[], period = 14): number {
    const result = ti.RSI.calculate({ values: closes, period });
    return result[result.length - 1] ?? 0;
  }

  calculateMacd(closes: number[]): MacdResult {
    const result = ti.MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const last = result[result.length - 1];
    if (!last) return { value: 0, signal: 0, histogram: 0 };
    return {
      value: last.MACD ?? 0,
      signal: last.signal ?? 0,
      histogram: last.histogram ?? 0,
    };
  }

  calculateMa(closes: number[], period: number): number {
    if (closes.length < period) return 0;
    const slice = closes.slice(-period);
    return slice.reduce((sum, v) => sum + v, 0) / period;
  }

  async getIndicatorSummary(ticker: string): Promise<IndicatorSummary | null> {
    try {
      // Fetch 90 days to ensure we have enough data for MA60
      const ohlcv = await this.getOhlcv(ticker, 90);
      if (ohlcv.length === 0) return null;

      const closes = ohlcv.map((d) => d.close);
      const closes30d = closes.slice(-30);

      const rsi14 = this.calculateRsi(closes);
      const macd = this.calculateMacd(closes);
      const ma5 = this.calculateMa(closes, 5);
      const ma20 = this.calculateMa(closes, 20);
      const ma60 = this.calculateMa(closes, 60);

      return {
        ticker,
        rsi14,
        macd,
        ma: { ma5, ma20, ma60 },
        closes30d,
      };
    } catch (err) {
      this.logger.error(`getIndicatorSummary failed for ticker=${ticker}`, err);
      return null;
    }
  }
}
