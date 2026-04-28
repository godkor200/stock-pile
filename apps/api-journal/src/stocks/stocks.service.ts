import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { StockEntity } from '@stock-pile/db-schema';
import { Market } from '@stock-pile/shared-types';
import { RedisCacheService } from '../common/redis-cache.service';

const CACHE_TTL_SEARCH = 30;
const CACHE_TTL_TICKER = 60;

@Injectable()
export class StocksService {
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
   * 종목이 없으면 기본값으로 자동 등록 — 트랜잭션 내 사용 가능
   */
  async ensureExists(ticker: string, em?: EntityManager): Promise<StockEntity> {
    const repo = em ? em.getRepository(StockEntity) : this.stockRepo;
    const existing = await repo.findOne({ where: { ticker } });
    if (existing) return existing;

    const stock = repo.create({
      ticker,
      name: ticker,
      market: Market.KOSPI,
      sector: null,
    });
    return repo.save(stock);
  }
}
