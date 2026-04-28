import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TradeEntity } from '@stock-pile/db-schema';
import { TradeSide } from '@stock-pile/shared-types';
import { TradesRepository } from './trades.repository';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { BulkUpdateTradeDto } from './dto/bulk-update-trade.dto';
import { TradeFilterDto } from './dto/trade-filter.dto';
import { PositionsService } from '../positions/positions.service';
import { StocksService } from '../stocks/stocks.service';
import { PaginatedResponse } from '@stock-pile/shared-types';

@Injectable()
export class TradesService {
  constructor(
    private readonly tradesRepository: TradesRepository,
    private readonly positionsService: PositionsService,
    private readonly stocksService: StocksService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    userId: string,
    filter: TradeFilterDto,
  ): Promise<PaginatedResponse<TradeEntity>> {
    const { data, total } = await this.tradesRepository.findWithFilter(
      userId,
      filter,
    );
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: string): Promise<TradeEntity> {
    const trade = await this.tradesRepository.findOneByIdAndUser(id, userId);
    if (!trade) {
      throw new NotFoundException(`Trade ${id} not found`);
    }
    return trade;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateTradeDto,
  ): Promise<TradeEntity> {
    const trade = await this.findOne(id, userId);
    Object.assign(trade, dto);
    return this.tradesRepository.getRepo().save(trade);
  }

  async bulkUpdate(
    userId: string,
    dto: BulkUpdateTradeDto,
  ): Promise<{ affected: number }> {
    const patch = dto.patch as Record<string, unknown>;
    const affected = await this.tradesRepository.bulkUpdateByIdsAndUser(
      dto.tradeIds,
      userId,
      patch,
    );
    return { affected };
  }

  async remove(id: string, userId: string): Promise<void> {
    const deleted = await this.tradesRepository.deleteByIdAndUser(id, userId);
    if (!deleted) {
      throw new NotFoundException(`Trade ${id} not found`);
    }
  }

  async findMissingContext(
    userId: string,
    groupBy?: string,
  ): Promise<TradeEntity[]> {
    return this.tradesRepository.findMissingContext(userId, groupBy);
  }

  async quickStats(userId: string): Promise<{
    tradeCount: number;
    winRate: number;
    totalRealizedPnl: number;
  }> {
    return this.tradesRepository.quickStats(userId);
  }

  /** Chat bot이 내부에서 호출 — HTTP 노출 X */
  async createFromChat(
    userId: string,
    dto: CreateTradeDto,
  ): Promise<TradeEntity> {
    return this.createTrade(userId, dto);
  }

  /** CSV import가 내부에서 호출 — HTTP 노출 X */
  async createFromCsv(
    userId: string,
    dtos: CreateTradeDto[],
  ): Promise<TradeEntity[]> {
    const results: TradeEntity[] = [];
    for (const dto of dtos) {
      const trade = await this.createTrade(userId, dto);
      results.push(trade);
    }
    return results;
  }

  private async createTrade(
    userId: string,
    dto: CreateTradeDto,
  ): Promise<TradeEntity> {
    return this.dataSource.transaction(async (em) => {
      // 1. 종목 자동 등록
      await this.stocksService.ensureExists(dto.ticker, em);

      // 2. SELL 수량 검증 + position 업데이트 (트랜잭션 내)
      await this.positionsService.applyTrade(
        {
          userId,
          ticker: dto.ticker,
          side: dto.side,
          quantity: dto.quantity,
          price: dto.price,
        },
        em,
      );

      // 3. trade insert
      const tradeRepo = em.getRepository(TradeEntity);
      const trade = tradeRepo.create({
        userId,
        ticker: dto.ticker,
        side: dto.side as TradeSide,
        quantity: dto.quantity,
        price: dto.price,
        tradedAt: new Date(dto.tradedAt),
        reason: dto.reason ?? null,
        emotion: dto.emotion ?? null,
        tags: dto.tags ?? [],
        source: dto.source,
      });
      return tradeRepo.save(trade);
    });
  }
}
