import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TradeEntity } from '@stock-pile/db-schema';
import { Emotion, TradeSide, TradeSource } from '@stock-pile/shared-types';
import { TradesRepository } from './trades.repository';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { BulkUpdateTradeDto } from './dto/bulk-update-trade.dto';
import { TradeFilterDto } from './dto/trade-filter.dto';
import { PositionsService } from '../positions/positions.service';
import { StocksService } from '../stocks/stocks.service';
import { PaginatedResponse } from '@stock-pile/shared-types';
import * as Papa from 'papaparse';
import * as iconv from 'iconv-lite';

const SIDE_MAP: Record<string, TradeSide> = {
  매수: TradeSide.BUY, buy: TradeSide.BUY, BUY: TradeSide.BUY,
  매도: TradeSide.SELL, sell: TradeSide.SELL, SELL: TradeSide.SELL,
};

const EMOTION_MAP: Record<string, Emotion> = {
  계획: Emotion.PLANNED, PLANNED: Emotion.PLANNED,
  충동: Emotion.IMPULSIVE, IMPULSIVE: Emotion.IMPULSIVE,
  뉴스: Emotion.NEWS_REACTION, NEWS_REACTION: Emotion.NEWS_REACTION,
  기술: Emotion.TECHNICAL, TECHNICAL: Emotion.TECHNICAL,
  포모: Emotion.FOMO, FOMO: Emotion.FOMO,
};

@Injectable()
export class TradesService {
  private readonly logger = new Logger(TradesService.name);

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

  /** 최근 N건 매매 이력 조회 — 어드바이저 컨텍스트용 */
  async findRecent(userId: string, limit: number): Promise<TradeEntity[]> {
    const { data } = await this.tradesRepository.findWithFilter(userId, {
      page: 1,
      limit,
      sort: 'tradedAt',
      order: 'DESC',
    });
    return data;
  }

  /**
   * CSV 파일(Buffer)을 파싱해 일괄 매매 저장
   * 지원 인코딩: UTF-8, EUC-KR (자동 감지)
   * 헤더: ticker, side, quantity, price, tradedAt, reason(선택), emotion(선택)
   */
  async importFromCsv(
    userId: string,
    buffer: Buffer,
  ): Promise<{ imported: number; errors: string[] }> {
    // EUC-KR 감지: 0x80 이상 바이트가 있으면 EUC-KR로 디코딩 시도
    const hasHighBytes = buffer.some((b) => b > 0x7f);
    const text = hasHighBytes
      ? iconv.decode(buffer, 'euc-kr')
      : buffer.toString('utf-8');

    const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(text.trim(), {
      header: true,
      skipEmptyLines: true,
    });

    if (parseErrors.length > 0) {
      throw new BadRequestException(`CSV 파싱 오류: ${parseErrors[0].message}`);
    }

    const rowErrors: string[] = [];
    const dtos: CreateTradeDto[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // 헤더 제외

      const side = SIDE_MAP[row['side']?.trim() ?? ''];
      if (!side) { rowErrors.push(`행 ${rowNum}: side 값 오류 (${row['side']})`); continue; }

      const quantity = Number(row['quantity']);
      if (!quantity || quantity <= 0) { rowErrors.push(`행 ${rowNum}: quantity 오류`); continue; }

      const price = Number(row['price']);
      if (isNaN(price) || price < 0) { rowErrors.push(`행 ${rowNum}: price 오류`); continue; }

      const ticker = row['ticker']?.trim();
      if (!ticker) { rowErrors.push(`행 ${rowNum}: ticker 없음`); continue; }

      const tradedAt = row['tradedAt']?.trim();
      if (!tradedAt || isNaN(Date.parse(tradedAt))) { rowErrors.push(`행 ${rowNum}: tradedAt 오류 (YYYY-MM-DD 형식)`); continue; }

      const emotion = row['emotion']?.trim()
        ? EMOTION_MAP[row['emotion'].trim()]
        : undefined;

      dtos.push({
        ticker,
        side,
        quantity,
        price,
        tradedAt: new Date(tradedAt).toISOString(),
        reason: row['reason']?.trim() || undefined,
        emotion,
        tags: [],
        source: TradeSource.CSV_IMPORT,
      });
    }

    const results = await this.createFromCsv(userId, dtos);
    this.logger.log(`CSV import: userId=${userId} imported=${results.length} errors=${rowErrors.length}`);

    return { imported: results.length, errors: rowErrors };
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
