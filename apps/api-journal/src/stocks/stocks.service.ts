import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { StockEntity } from '@stock-pile/db-schema';
import { Market } from '@stock-pile/shared-types';

@Injectable()
export class StocksService {
  constructor(
    @InjectRepository(StockEntity)
    private readonly stockRepo: Repository<StockEntity>,
  ) {}

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
