import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { StockEntity } from '@stock-pile/db-schema';
import { Market } from '@stock-pile/shared-types';
import { RedisCacheService } from '../common/redis-cache.service';

const CACHE_TTL_SEARCH = 30;
const CACHE_TTL_TICKER = 60;
const CACHE_TTL_PRICE = 900; // 15분

interface YahooMeta {
  regularMarketPrice?: number;
  shortName?: string;
  exchangeName?: string; // KSC=KOSPI, KOE=KOSDAQ
}

interface YahooChartResponse {
  chart: {
    result?: { meta: YahooMeta }[];
    error?: unknown;
  };
}

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);

  constructor(
    @InjectRepository(StockEntity)
    private readonly stockRepo: Repository<StockEntity>,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * 종목명/티커 검색 (최대 10건, starts-with 우선)
   */
  async search(query: string): Promise<StockEntity[]> {
    const key = `stocks:search:${query.toLowerCase()}`;
    const cached = await this.cache.get<StockEntity[]>(key);
    if (cached) return cached;

    const q = query.toLowerCase();
    const results = await this.stockRepo
      .createQueryBuilder('s')
      .where('LOWER(s.ticker) LIKE :prefix OR LOWER(s.name) LIKE :contains', {
        prefix: `${q}%`,
        contains: `%${q}%`,
      })
      .orderBy(
        `CASE WHEN LOWER(s.ticker) LIKE '${q}%' OR LOWER(s.name) LIKE '${q}%' THEN 0 ELSE 1 END`,
      )
      .limit(10)
      .getMany();

    await this.cache.set(key, results, CACHE_TTL_SEARCH);
    return results;
  }

  /**
   * 티커로 단일 종목 조회
   */
  async findByTicker(ticker: string): Promise<StockEntity | null> {
    const key = `stocks:ticker:${ticker}`;
    const cached = await this.cache.get<StockEntity>(key);
    if (cached) return cached;

    const stock = await this.stockRepo.findOne({ where: { ticker } });
    if (stock) await this.cache.set(key, stock, CACHE_TTL_TICKER);
    return stock;
  }

  /**
   * 종목이 없으면 Yahoo Finance 메타로 시장/이름을 채워 자동 등록
   * 트랜잭션 내 사용 가능 (em 전달 시)
   */
  async ensureExists(ticker: string, em?: EntityManager): Promise<StockEntity> {
    const repo = em ? em.getRepository(StockEntity) : this.stockRepo;
    const existing = await repo.findOne({ where: { ticker } });
    if (existing) return existing;

    // 한국 종목 여부 판별: 6자리 숫자 티커
    const isKorean = /^\d{6}$/.test(ticker);
    let market = Market.KOSPI;

    if (isKorean) {
      const meta = await this.fetchYahooMeta(ticker, Market.KOSPI);
      if (meta?.exchangeName === 'KOE') market = Market.KOSDAQ;
    }

    const stock = repo.create({ ticker, name: ticker, market, sector: null });
    return repo.save(stock);
  }

  /**
   * Yahoo Finance에서 현재가 조회 (15분 Redis 캐시)
   * 조회 실패 시 null 반환
   */
  async fetchCurrentPrice(ticker: string): Promise<number | null> {
    const cacheKey = `stocks:price:${ticker}`;
    const cached = await this.cache.get<number>(cacheKey);
    if (cached !== null) return cached;

    const stock = await this.findByTicker(ticker);
    const market = stock?.market ?? Market.KOSPI;
    const meta = await this.fetchYahooMeta(ticker, market);
    const price = meta?.regularMarketPrice ?? null;

    if (price !== null) {
      await this.cache.set(cacheKey, price, CACHE_TTL_PRICE);
      this.logger.log(`현재가 조회 ${ticker}: ${price.toLocaleString('ko-KR')}원`);
    }
    return price;
  }

  /** Yahoo Finance에서 종목 메타 조회 (캐시 없음 — 호출자가 캐시 관리) */
  private async fetchYahooMeta(ticker: string, market: Market): Promise<YahooMeta | null> {
    const symbol = this.toYahooSymbol(ticker, market);
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5_000),
      });

      if (!res.ok) {
        this.logger.warn(`Yahoo Finance ${symbol}: HTTP ${res.status}`);
        return null;
      }

      const data = (await res.json()) as YahooChartResponse;
      return data.chart?.result?.[0]?.meta ?? null;
    } catch (err) {
      this.logger.warn(`Yahoo Finance 조회 실패 [${ticker}]: ${(err as Error).message}`);
      return null;
    }
  }

  private toYahooSymbol(ticker: string, market: Market): string {
    if (market === Market.KOSPI) return `${ticker}.KS`;
    if (market === Market.KOSDAQ) return `${ticker}.KQ`;
    return ticker; // NASDAQ, NYSE
  }
}
