import { Repository, EntityManager } from 'typeorm';
import { PositionsService } from './positions.service';
import { PositionEntity } from '@stock-pile/db-schema';
import { TradeSide } from '@stock-pile/shared-types';
import { InsufficientQuantityError } from '../trades/errors/insufficient-quantity.error';

// axios mock — Yahoo Finance 현재가 조회를 격리
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makePosition(overrides: Partial<PositionEntity> = {}): PositionEntity {
  const p = new PositionEntity();
  p.userId = 'user-1';
  p.ticker = '005930';
  p.quantity = 10;
  p.avgPrice = 70000;
  p.realizedPnl = 0;
  return Object.assign(p, overrides);
}

function buildService(repo: Partial<Repository<PositionEntity>>): PositionsService {
  return new PositionsService(repo as unknown as Repository<PositionEntity>);
}

describe('PositionsService', () => {
  let positionRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    positionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ── findAll ────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('quantity=0인 포지션은 currentPrice=null을 반환한다', async () => {
      const zeroPosn = makePosition({ quantity: 0 });
      positionRepo.find.mockResolvedValue([zeroPosn]);

      const result = await buildService(positionRepo).findAll('user-1');

      expect(result[0].currentPrice).toBeNull();
      expect(result[0].unrealizedPnl).toBeNull();
      expect(result[0].unrealizedPnlPct).toBeNull();
    });

    it('Yahoo Finance 현재가 조회 성공 → 미실현 손익 계산', async () => {
      const position = makePosition({ quantity: 10, avgPrice: 70000 });
      positionRepo.find.mockResolvedValue([position]);

      mockedAxios.get.mockResolvedValue({
        data: {
          chart: {
            result: [
              { indicators: { quote: [{ close: [null, 75000] }] } },
            ],
          },
        },
      });

      const result = await buildService(positionRepo).findAll('user-1');

      expect(result[0].currentPrice).toBe(75000);
      // (75000 - 70000) * 10 = 50000
      expect(result[0].unrealizedPnl).toBe(50000);
      // (75000 - 70000) / 70000 * 100
      expect(result[0].unrealizedPnlPct).toBeCloseTo(7.142857, 4);
    });

    it('Yahoo Finance 실패 → currentPrice=null, PnL=null (graceful)', async () => {
      const position = makePosition({ quantity: 5, avgPrice: 60000 });
      positionRepo.find.mockResolvedValue([position]);
      mockedAxios.get.mockRejectedValue(new Error('network error'));

      const result = await buildService(positionRepo).findAll('user-1');

      expect(result[0].currentPrice).toBeNull();
      expect(result[0].unrealizedPnl).toBeNull();
    });

    it('보유 포지션이 없으면 빈 배열 반환', async () => {
      positionRepo.find.mockResolvedValue([]);

      const result = await buildService(positionRepo).findAll('user-1');

      expect(result).toEqual([]);
    });
  });

  // ── applyTrade ─────────────────────────────────────────────────────
  describe('applyTrade', () => {
    let positionStore: PositionEntity | null;
    let mockPositionRepo: {
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };
    let mockEm: { getRepository: jest.Mock };

    beforeEach(() => {
      positionStore = null;

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
        create: jest.fn((data: Partial<PositionEntity>) => makePosition(data)),
        save: jest.fn(async (entity: PositionEntity) => {
          positionStore = { ...entity };
          return positionStore;
        }),
      };

      mockEm = {
        getRepository: jest.fn(() => mockPositionRepo),
      };
    });

    it('BUY → 신규 포지션 생성 (quantity, avgPrice 설정)', async () => {
      const service = buildService(positionRepo);
      await service.applyTrade(
        { userId: 'user-1', ticker: '005930', side: TradeSide.BUY, quantity: 10, price: 70000 },
        mockEm as unknown as EntityManager,
      );

      expect(positionStore).not.toBeNull();
      expect(positionStore!.quantity).toBe(10);
      expect(positionStore!.avgPrice).toBe(70000);
    });

    it('BUY 추가 → 가중평균가 갱신', async () => {
      const service = buildService(positionRepo);

      // 1차 BUY: 10주 @70000
      await service.applyTrade(
        { userId: 'user-1', ticker: '005930', side: TradeSide.BUY, quantity: 10, price: 70000 },
        mockEm as unknown as EntityManager,
      );
      // 2차 BUY: 10주 @80000
      await service.applyTrade(
        { userId: 'user-1', ticker: '005930', side: TradeSide.BUY, quantity: 10, price: 80000 },
        mockEm as unknown as EntityManager,
      );

      expect(positionStore!.quantity).toBe(20);
      // (10*70000 + 10*80000) / 20 = 75000
      expect(positionStore!.avgPrice).toBe(75000);
    });

    it('부분 SELL → quantity 감소, realizedPnl 누적', async () => {
      const service = buildService(positionRepo);

      await service.applyTrade(
        { userId: 'user-1', ticker: '005930', side: TradeSide.BUY, quantity: 10, price: 70000 },
        mockEm as unknown as EntityManager,
      );
      await service.applyTrade(
        { userId: 'user-1', ticker: '005930', side: TradeSide.SELL, quantity: 5, price: 75000 },
        mockEm as unknown as EntityManager,
      );

      expect(positionStore!.quantity).toBe(5);
      // realizedPnl = (75000 - 70000) * 5 = 25000
      expect(positionStore!.realizedPnl).toBe(25000);
    });

    it('전량 SELL → quantity = 0', async () => {
      const service = buildService(positionRepo);

      await service.applyTrade(
        { userId: 'user-1', ticker: '005930', side: TradeSide.BUY, quantity: 10, price: 70000 },
        mockEm as unknown as EntityManager,
      );
      await service.applyTrade(
        { userId: 'user-1', ticker: '005930', side: TradeSide.SELL, quantity: 10, price: 72000 },
        mockEm as unknown as EntityManager,
      );

      expect(positionStore!.quantity).toBe(0);
      // realizedPnl = (72000 - 70000) * 10 = 20000
      expect(positionStore!.realizedPnl).toBe(20000);
    });

    it('포지션 없는 상태에서 SELL → InsufficientQuantityError', async () => {
      const service = buildService(positionRepo);

      await expect(
        service.applyTrade(
          { userId: 'user-1', ticker: '005930', side: TradeSide.SELL, quantity: 5, price: 70000 },
          mockEm as unknown as EntityManager,
        ),
      ).rejects.toBeInstanceOf(InsufficientQuantityError);
    });

    it('보유 수량보다 많은 SELL → InsufficientQuantityError', async () => {
      const service = buildService(positionRepo);

      await service.applyTrade(
        { userId: 'user-1', ticker: '005930', side: TradeSide.BUY, quantity: 3, price: 70000 },
        mockEm as unknown as EntityManager,
      );
      await expect(
        service.applyTrade(
          { userId: 'user-1', ticker: '005930', side: TradeSide.SELL, quantity: 5, price: 70000 },
          mockEm as unknown as EntityManager,
        ),
      ).rejects.toBeInstanceOf(InsufficientQuantityError);
    });
  });
});
