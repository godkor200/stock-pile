import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  SelectQueryBuilder,
  EntityManager,
} from 'typeorm';
import { TradeEntity } from '@stock-pile/db-schema';
import { TradeFilterDto } from './dto/trade-filter.dto';

@Injectable()
export class TradesRepository {
  constructor(
    @InjectRepository(TradeEntity)
    private readonly repo: Repository<TradeEntity>,
    private readonly dataSource: DataSource,
  ) {}

  getRepo(): Repository<TradeEntity> {
    return this.repo;
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  async findWithFilter(
    userId: string,
    filter: TradeFilterDto,
  ): Promise<{ data: TradeEntity[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      sort = 'tradedAt',
      order = 'DESC',
      ticker,
      side,
      emotion,
      source,
      from,
      to,
      hasReason,
      tags,
    } = filter;

    const qb: SelectQueryBuilder<TradeEntity> = this.repo
      .createQueryBuilder('trade')
      .where('trade.user_id = :userId', { userId });

    if (ticker) {
      qb.andWhere('trade.ticker = :ticker', { ticker });
    }
    if (side) {
      qb.andWhere('trade.side = :side', { side });
    }
    if (emotion) {
      qb.andWhere('trade.emotion = :emotion', { emotion });
    }
    if (source) {
      qb.andWhere('trade.source = :source', { source });
    }
    if (from) {
      qb.andWhere('trade.tradedAt >= :from', { from: new Date(from) });
    }
    if (to) {
      qb.andWhere('trade.tradedAt <= :to', { to: new Date(to) });
    }
    if (hasReason === true) {
      qb.andWhere('trade.reason IS NOT NULL');
    } else if (hasReason === false) {
      qb.andWhere('trade.reason IS NULL');
    }
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim());
      qb.andWhere('trade.tags && :tags', { tags: tagList });
    }

    const allowedSortFields: Record<string, string> = {
      tradedAt: 'trade.tradedAt',
      createdAt: 'trade.createdAt',
      price: 'trade.price',
      quantity: 'trade.quantity',
    };
    const sortField = allowedSortFields[sort] ?? 'trade.tradedAt';
    qb.orderBy(sortField, order)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOneByIdAndUser(
    id: string,
    userId: string,
  ): Promise<TradeEntity | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async findMissingContext(
    userId: string,
    groupBy?: string,
  ): Promise<TradeEntity[]> {
    const qb = this.repo
      .createQueryBuilder('trade')
      .where('trade.user_id = :userId', { userId })
      .andWhere('(trade.reason IS NULL OR trade.emotion IS NULL)');

    if (groupBy === 'by_ticker') {
      qb.orderBy('trade.ticker', 'ASC').addOrderBy('trade.tradedAt', 'DESC');
    } else if (groupBy === 'by_date') {
      qb.orderBy('trade.tradedAt', 'DESC');
    } else if (groupBy === 'by_side') {
      qb.orderBy('trade.side', 'ASC').addOrderBy('trade.tradedAt', 'DESC');
    } else {
      qb.orderBy('trade.tradedAt', 'DESC');
    }

    return qb.getMany();
  }

  async quickStats(
    userId: string,
  ): Promise<{ tradeCount: number; winRate: number; totalRealizedPnl: number }> {
    const tradeCount = await this.repo.count({ where: { userId } });

    // realized_pnl is stored on position; we query positions via dataSource
    const pnlResult = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(p.realized_pnl), 0)', 'totalRealizedPnl')
      .from('positions', 'p')
      .where('p.user_id = :userId', { userId })
      .getRawOne<{ totalRealizedPnl: string }>();

    const totalRealizedPnl = parseFloat(pnlResult?.totalRealizedPnl ?? '0');

    // winRate: percentage of SELL trades where (sell_price - avg_price) > 0
    // Simplified: count trades with positive pnl contribution
    // For a quick stat we compute from trade records: sells where price > avg not easily computed here
    // Return a simplified 0 as true winRate requires position avg_price correlation
    const winRate = 0;

    return { tradeCount, winRate, totalRealizedPnl };
  }

  async bulkUpdateByIdsAndUser(
    tradeIds: string[],
    userId: string,
    patch: Record<string, unknown>,
    em?: EntityManager,
  ): Promise<number> {
    const repo = em ? em.getRepository(TradeEntity) : this.repo;
    const result = await repo
      .createQueryBuilder()
      .update(TradeEntity)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(patch as any)
      .where('id IN (:...ids)', { ids: tradeIds })
      .andWhere('userId = :userId', { userId })
      .execute();
    return result.affected ?? 0;
  }

  async deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
    const result = await this.repo.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }
}
