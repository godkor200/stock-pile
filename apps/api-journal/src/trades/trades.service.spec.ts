import { DataSource, EntityManager, Repository } from 'typeorm';
import { TradesService } from './trades.service';
import { TradesRepository } from './trades.repository';
import { PositionsService } from '../positions/positions.service';
import { StocksService } from '../stocks/stocks.service';
import { TradeEntity } from '@stock-pile/db-schema';
import { PositionEntity } from '@stock-pile/db-schema';
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
  let mockEm: any;
  let mockPositionRepo: any;
  let mockTradeRepo: any;
  let mockStockRepo: any;

  beforeEach(async () => {
    positionStore = null;
    tradeIdCounter = 0;

    // position repo mock
    mockPositionRepo = {
      findOne: jest.fn(async ({ where }: any) => {
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
    } as any;

    // trade repo mock
    mockTradeRepo = {
      create: jest.fn((data: Partial<TradeEntity>) => makeTrade(data)),
      save: jest.fn(async (entity: TradeEntity) => {
        tradeIdCounter++;
        return { ...entity, id: `trade-uuid-${tradeIdCounter}` };
      }),
    } as any;

    // stock repo mock
    mockStockRepo = {
      findOne: jest.fn(async () => ({
        ticker: 'SAMSUNG',
        name: 'SAMSUNG',
        market: 'KOSPI',
      })),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockEm = {
      getRepository: jest.fn((entity: any) => {
        if (entity === PositionEntity) return mockPositionRepo;
        if (entity === TradeEntity) return mockTradeRepo;
        return mockStockRepo;
      }),
    } as any;

    // DataSource mock — transaction calls the callback with mockEm
    dataSource = {
      transaction: jest.fn(
        async (cb: (em: EntityManager) => Promise<any>) =>
          cb(mockEm as EntityManager),
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
      mockPositionRepo as Repository<PositionEntity>,
    );

    // Real StocksService backed by mock stock repo
    stocksService = new StocksService(
      mockStockRepo as Repository<any>,
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
    await (service as any).createTrade('user-1', makeBuyDto());

    expect(positionStore).not.toBeNull();
    expect(positionStore!.quantity).toBe(10);
    expect(positionStore!.avgPrice).toBe(70000);
  });

  // ----------------------------------------------------------------
  // 2. 추가 BUY → 가중평균가 갱신
  // ----------------------------------------------------------------
  it('추가 BUY → 가중평균가 갱신', async () => {
    // 1차 BUY: 10주 @70000
    await (service as any).createTrade('user-1', makeBuyDto());
    // 2차 BUY: 10주 @80000
    await (service as any).createTrade(
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
    await (service as any).createTrade('user-1', makeBuyDto()); // 10주 @70000
    await (service as any).createTrade(
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
    await (service as any).createTrade('user-1', makeBuyDto()); // 10주
    await (service as any).createTrade(
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
      (service as any).createTrade('user-1', makeSellDto()),
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
});
