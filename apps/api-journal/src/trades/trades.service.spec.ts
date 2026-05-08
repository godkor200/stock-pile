import { DataSource, EntityManager, Repository } from 'typeorm';
import { TradesService } from './trades.service';
import { TradesRepository } from './trades.repository';
import { PositionsService } from '../positions/positions.service';
import { StocksService } from '../stocks/stocks.service';
import { RedisCacheService } from '../common/redis-cache.service';
import { TradeEntity } from '@stock-pile/db-schema';
import { PositionEntity } from '@stock-pile/db-schema';
import { StockEntity } from '@stock-pile/db-schema';
import { TradeSide, TradeSource } from '@stock-pile/shared-types';
import { InsufficientQuantityError } from './errors/insufficient-quantity.error';
import { CreateTradeDto } from './dto/create-trade.dto';

// ---------- helpers ----------
function makePosition(
  overrides: Partial<PositionEntity> = {},
): PositionEntity {
  const p = new PositionEntity();
  p.userId = 'user-1';
  p.ticker = 'SAMSUNG';
  p.quantity = 0;
  p.avgPrice = 0;
  p.realizedPnl = 0;
  return Object.assign(p, overrides);
}

function makeTrade(overrides: Partial<TradeEntity> = {}): TradeEntity {
  const t = new TradeEntity();
  t.id = 'trade-uuid-1';
  t.userId = 'user-1';
  t.ticker = 'SAMSUNG';
  t.side = TradeSide.BUY;
  t.quantity = 10;
  t.price = 70000;
  t.tradedAt = new Date('2026-04-01');
  t.reason = null;
  t.emotion = null;
  t.tags = [];
  t.source = TradeSource.CHATBOT;
  t.createdAt = new Date();
  return Object.assign(t, overrides);
}

function makeBuyDto(overrides: Partial<CreateTradeDto> = {}): CreateTradeDto {
  return {
    ticker: 'SAMSUNG',
    side: TradeSide.BUY,
    quantity: 10,
    price: 70000,
    tradedAt: '2026-04-01T09:00:00.000Z',
    source: TradeSource.CHATBOT,
    ...overrides,
  } as CreateTradeDto;
}

function makeSellDto(overrides: Partial<CreateTradeDto> = {}): CreateTradeDto {
  return {
    ticker: 'SAMSUNG',
    side: TradeSide.SELL,
    quantity: 5,
    price: 75000,
    tradedAt: '2026-04-10T09:00:00.000Z',
    source: TradeSource.CHATBOT,
    ...overrides,
  } as CreateTradeDto;
}

// private 메서드 접근용 타입
type TradesServicePrivate = {
  createTrade(userId: string, dto: CreateTradeDto): Promise<TradeEntity>;
};

// ---------- test suite ----------
describe('TradesService', () => {
  let service: TradesService;
  let positionsService: PositionsService;
  let stocksService: StocksService;
  let tradesRepository: TradesRepository;
  let dataSource: DataSource;

  // position state we mutate per test
  let positionStore: PositionEntity | null;
  let tradeIdCounter: number;

  // EntityManager mock
  let mockEm: { getRepository: jest.Mock };
  let mockPositionRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let mockTradeRepo: { create: jest.Mock; save: jest.Mock };
  let mockStockRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    positionStore = null;
    tradeIdCounter = 0;

    // position repo mock
    mockPositionRepo = {
      findOne: jest.fn(async ({ where }: { where: { userId: string; ticker: string } }) => {
        if (
          positionStore &&
          positionStore.userId === where.userId &&
          positionStore.ticker === where.ticker
        ) {
          return positionStore;
        }
        return null;
      }),
      create: jest.fn((data: Partial<PositionEntity>) => {
        return makePosition(data);
      }),
      save: jest.fn(async (entity: PositionEntity) => {
        positionStore = { ...entity };
        return positionStore;
      }),
    };

    // trade repo mock
    mockTradeRepo = {
      create: jest.fn((data: Partial<TradeEntity>) => makeTrade(data)),
      save: jest.fn(async (entity: TradeEntity) => {
        tradeIdCounter++;
        return { ...entity, id: `trade-uuid-${tradeIdCounter}` };
      }),
    };

    // stock repo mock
    mockStockRepo = {
      findOne: jest.fn(async () => ({
        ticker: 'SAMSUNG',
        name: 'SAMSUNG',
        market: 'KOSPI',
      })),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockEm = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PositionEntity) return mockPositionRepo;
        if (entity === TradeEntity) return mockTradeRepo;
        return mockStockRepo;
      }),
    };

    // DataSource mock — transaction calls the callback with mockEm
    dataSource = {
      transaction: jest.fn(
        async (cb: (em: EntityManager) => Promise<unknown>) =>
          cb(mockEm as unknown as EntityManager),
      ),
      createQueryBuilder: jest.fn(),
    } as unknown as DataSource;

    // TradesRepository mock (not exercised in these unit tests)
    tradesRepository = {
      getRepo: jest.fn(),
      getDataSource: jest.fn(),
      findWithFilter: jest.fn(),
      findOneByIdAndUser: jest.fn(),
      findMissingContext: jest.fn(),
      quickStats: jest.fn(),
      bulkUpdateByIdsAndUser: jest.fn(),
      deleteByIdAndUser: jest.fn(),
    } as unknown as TradesRepository;

    // Real PositionsService backed by mock repo
    positionsService = new PositionsService(
      mockPositionRepo as unknown as Repository<PositionEntity>,
    );

    // Real StocksService backed by mock stock repo
    const noopCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as RedisCacheService;
    stocksService = new StocksService(
      mockStockRepo as unknown as Repository<StockEntity>,
      noopCache,
    );

    service = new TradesService(
      tradesRepository,
      positionsService,
      stocksService,
      dataSource,
    );
  });

  // ----------------------------------------------------------------
  // 1. BUY → position 생성, 평균가 계산
  // ----------------------------------------------------------------
  it('BUY → 포지션 생성 및 평균가 설정', async () => {
    await (service as unknown as TradesServicePrivate).createTrade('user-1', makeBuyDto());

    expect(positionStore).not.toBeNull();
    expect(positionStore!.quantity).toBe(10);
    expect(positionStore!.avgPrice).toBe(70000);
  });

  // ----------------------------------------------------------------
  // 2. 추가 BUY → 가중평균가 갱신
  // ----------------------------------------------------------------
  it('추가 BUY → 가중평균가 갱신', async () => {
    // 1차 BUY: 10주 @70000
    await (service as unknown as TradesServicePrivate).createTrade('user-1', makeBuyDto());
    // 2차 BUY: 10주 @80000
    await (service as unknown as TradesServicePrivate).createTrade(
      'user-1',
      makeBuyDto({ quantity: 10, price: 80000 }),
    );

    expect(positionStore!.quantity).toBe(20);
    // (10*70000 + 10*80000) / 20 = 75000
    expect(positionStore!.avgPrice).toBe(75000);
  });

  // ----------------------------------------------------------------
  // 3. 부분 SELL → quantity 감소, realized_pnl 누적
  // ----------------------------------------------------------------
  it('부분 SELL → quantity 감소 및 realized_pnl 누적', async () => {
    await (service as unknown as TradesServicePrivate).createTrade('user-1', makeBuyDto()); // 10주 @70000
    await (service as unknown as TradesServicePrivate).createTrade(
      'user-1',
      makeSellDto({ quantity: 5, price: 75000 }),
    );

    expect(positionStore!.quantity).toBe(5);
    // realized_pnl = (75000 - 70000) * 5 = 25000
    expect(positionStore!.realizedPnl).toBe(25000);
  });

  // ----------------------------------------------------------------
  // 4. 전량 SELL → quantity = 0
  // ----------------------------------------------------------------
  it('전량 SELL → quantity = 0', async () => {
    await (service as unknown as TradesServicePrivate).createTrade('user-1', makeBuyDto()); // 10주
    await (service as unknown as TradesServicePrivate).createTrade(
      'user-1',
      makeSellDto({ quantity: 10, price: 72000 }),
    );

    expect(positionStore!.quantity).toBe(0);
    // realized_pnl = (72000 - 70000) * 10 = 20000
    expect(positionStore!.realizedPnl).toBe(20000);
  });

  // ----------------------------------------------------------------
  // 5. 보유 없는 상태에서 SELL → InsufficientQuantityError
  // ----------------------------------------------------------------
  it('보유 없는 상태에서 SELL → InsufficientQuantityError', async () => {
    await expect(
      (service as unknown as TradesServicePrivate).createTrade('user-1', makeSellDto()),
    ).rejects.toBeInstanceOf(InsufficientQuantityError);
  });

  // ----------------------------------------------------------------
  // 6. bulkUpdate — 다른 userId의 trade는 변경 안 됨
  // ----------------------------------------------------------------
  it('bulkUpdate → 다른 userId 소유 trade는 변경되지 않음', async () => {
    (tradesRepository.bulkUpdateByIdsAndUser as jest.Mock).mockResolvedValue(0);

    const result = await service.bulkUpdate('user-other', {
      tradeIds: ['trade-uuid-1', 'trade-uuid-2'],
      patch: { reason: 'updated reason' },
    });

    expect(tradesRepository.bulkUpdateByIdsAndUser as jest.Mock).toHaveBeenCalledWith(
      ['trade-uuid-1', 'trade-uuid-2'],
      'user-other',
      { reason: 'updated reason' },
    );
    // affected=0 이므로 다른 유저 trade 변경 없음
    expect(result.affected).toBe(0);
  });

  // ----------------------------------------------------------------
  // 7. importFromCsv — UTF-8 인코딩 정상 파싱
  // ----------------------------------------------------------------
  describe('importFromCsv', () => {
    it('UTF-8 CSV를 파싱하여 한글 reason을 올바르게 저장한다', async () => {
      const csv = [
        'ticker,side,quantity,price,tradedAt,reason,emotion',
        '005930,BUY,10,70000,2026-01-01,반도체 저점 매수,PLANNED',
      ].join('\n');
      const buffer = Buffer.from(csv, 'utf-8');

      // stocksService.ensureExists mock
      (stocksService as unknown as { ensureExists: jest.Mock }).ensureExists =
        jest.fn().mockResolvedValue(undefined);

      const result = await service.importFromCsv('user-1', buffer);

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);

      const savedTrade = (mockTradeRepo.save as jest.Mock).mock.calls[0][0] as TradeEntity;
      expect(savedTrade.reason).toBe('반도체 저점 매수');
      expect(savedTrade.ticker).toBe('005930');
      expect(savedTrade.quantity).toBe(10);
    });

    it('UTF-8 BOM이 있는 CSV도 정상 파싱한다', async () => {
      const csv = 'ticker,side,quantity,price,tradedAt\n005930,BUY,5,68000,2026-02-01';
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const buffer = Buffer.concat([bom, Buffer.from(csv, 'utf-8')]);

      (stocksService as unknown as { ensureExists: jest.Mock }).ensureExists =
        jest.fn().mockResolvedValue(undefined);

      const result = await service.importFromCsv('user-1', buffer);

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('side 값이 잘못되면 해당 행은 errors에 포함된다', async () => {
      const csv = [
        'ticker,side,quantity,price,tradedAt',
        '005930,INVALID,10,70000,2026-01-01',
      ].join('\n');
      const buffer = Buffer.from(csv, 'utf-8');

      const result = await service.importFromCsv('user-1', buffer);

      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('side 값 오류');
    });

    it('tradedAt 형식이 잘못되면 해당 행은 errors에 포함된다', async () => {
      const csv = [
        'ticker,side,quantity,price,tradedAt',
        '005930,BUY,10,70000,not-a-date',
      ].join('\n');
      const buffer = Buffer.from(csv, 'utf-8');

      const result = await service.importFromCsv('user-1', buffer);

      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('tradedAt 오류');
    });

    it('한글 side 값(매수/매도)도 인식한다', async () => {
      const csv = [
        'ticker,side,quantity,price,tradedAt',
        '005930,매수,10,70000,2026-01-01',
      ].join('\n');
      const buffer = Buffer.from(csv, 'utf-8');

      (stocksService as unknown as { ensureExists: jest.Mock }).ensureExists =
        jest.fn().mockResolvedValue(undefined);

      const result = await service.importFromCsv('user-1', buffer);

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });
});
