import { DataSource } from 'typeorm';
import { TradesService } from './trades.service';
import { TradesRepository } from './trades.repository';
import { PositionsService } from '../positions/positions.service';
import { StocksService } from '../stocks/stocks.service';
import { TradeEntity } from '@stock-pile/db-schema';
import { TradeSide, TradeSource } from '@stock-pile/shared-types';

function makeTrade(overrides: Partial<TradeEntity>): TradeEntity {
  const t = new TradeEntity();
  t.id = Math.random().toString(36).slice(2);
  t.userId = 'user-1';
  t.ticker = '005930';
  t.side = TradeSide.BUY;
  t.quantity = 10;
  t.price = 70000;
  t.tradedAt = new Date('2026-01-10');
  t.source = TradeSource.CHATBOT;
  t.tags = [];
  return Object.assign(t, overrides);
}

describe('TradesService.dailyStats — running avg-cost P&L', () => {
  let service: TradesService;
  let mockRepo: { findAllOrdered: jest.Mock };

  beforeEach(() => {
    mockRepo = { findAllOrdered: jest.fn() };

    service = new TradesService(
      mockRepo as unknown as TradesRepository,
      {} as PositionsService,
      {} as StocksService,
      {} as DataSource,
    );
  });

  // ── 기본 BUY → SELL 사이클 ──────────────────────────────────────────────
  it('BUY 10주 @70000 → SELL 10주 @80000 → pnl=100000', async () => {
    mockRepo.findAllOrdered.mockResolvedValue([
      makeTrade({ side: TradeSide.BUY, quantity: 10, price: 70000, tradedAt: new Date('2026-01-05') }),
      makeTrade({ side: TradeSide.SELL, quantity: 10, price: 80000, tradedAt: new Date('2026-01-10') }),
    ]);

    const result = await service.dailyStats('user-1', 2026);

    const sellDay = result.find((r) => r.date === '2026-01-10');
    expect(sellDay?.pnl).toBeCloseTo(100000);
  });

  it('손실 SELL → pnl 음수', async () => {
    mockRepo.findAllOrdered.mockResolvedValue([
      makeTrade({ side: TradeSide.BUY, quantity: 10, price: 70000, tradedAt: new Date('2026-02-01') }),
      makeTrade({ side: TradeSide.SELL, quantity: 5, price: 60000, tradedAt: new Date('2026-02-15') }),
    ]);

    const result = await service.dailyStats('user-1', 2026);

    const sellDay = result.find((r) => r.date === '2026-02-15');
    // (60000 - 70000) * 5 = -50000
    expect(sellDay?.pnl).toBeCloseTo(-50000);
  });

  // ── 가중평균가 갱신 후 SELL ────────────────────────────────────────────────
  it('두 번 BUY 후 SELL → 가중평균가 기반 P&L', async () => {
    mockRepo.findAllOrdered.mockResolvedValue([
      makeTrade({ side: TradeSide.BUY, quantity: 10, price: 60000, tradedAt: new Date('2026-03-01') }),
      makeTrade({ side: TradeSide.BUY, quantity: 10, price: 80000, tradedAt: new Date('2026-03-02') }),
      // avgPrice = (10*60000 + 10*80000) / 20 = 70000
      makeTrade({ side: TradeSide.SELL, quantity: 20, price: 75000, tradedAt: new Date('2026-03-10') }),
    ]);

    const result = await service.dailyStats('user-1', 2026);

    const sellDay = result.find((r) => r.date === '2026-03-10');
    // (75000 - 70000) * 20 = 100000
    expect(sellDay?.pnl).toBeCloseTo(100000);
  });

  // ── 여러 날짜 집계 ────────────────────────────────────────────────────────
  it('같은 날 여러 SELL → pnl 합산', async () => {
    mockRepo.findAllOrdered.mockResolvedValue([
      makeTrade({ ticker: '005930', side: TradeSide.BUY, quantity: 10, price: 60000, tradedAt: new Date('2026-04-01') }),
      makeTrade({ ticker: '000660', side: TradeSide.BUY, quantity: 5, price: 40000, tradedAt: new Date('2026-04-01') }),
      makeTrade({ ticker: '005930', side: TradeSide.SELL, quantity: 10, price: 70000, tradedAt: new Date('2026-04-15') }),
      makeTrade({ ticker: '000660', side: TradeSide.SELL, quantity: 5, price: 50000, tradedAt: new Date('2026-04-15') }),
    ]);

    const result = await service.dailyStats('user-1', 2026);

    const sellDay = result.find((r) => r.date === '2026-04-15');
    // 005930: (70000-60000)*10 = 100000
    // 000660: (50000-40000)*5 = 50000
    // total = 150000
    expect(sellDay?.pnl).toBeCloseTo(150000);
    expect(sellDay?.tradeCount).toBe(2);
  });

  // ── 연도 필터 ─────────────────────────────────────────────────────────────
  it('다른 연도 매매는 결과에 포함되지 않는다', async () => {
    mockRepo.findAllOrdered.mockResolvedValue([
      makeTrade({ side: TradeSide.BUY, quantity: 10, price: 70000, tradedAt: new Date('2025-12-01') }),
      makeTrade({ side: TradeSide.SELL, quantity: 10, price: 80000, tradedAt: new Date('2025-12-20') }),
    ]);

    const result = await service.dailyStats('user-1', 2026);

    expect(result).toHaveLength(0);
  });

  it('이전 연도 BUY → 당해 연도 SELL 시 avg-cost를 이어받아 P&L 계산', async () => {
    mockRepo.findAllOrdered.mockResolvedValue([
      makeTrade({ side: TradeSide.BUY, quantity: 10, price: 70000, tradedAt: new Date('2025-11-01') }),
      makeTrade({ side: TradeSide.SELL, quantity: 10, price: 80000, tradedAt: new Date('2026-01-15') }),
    ]);

    const result = await service.dailyStats('user-1', 2026);

    const sellDay = result.find((r) => r.date === '2026-01-15');
    expect(sellDay?.pnl).toBeCloseTo(100000);
  });

  // ── 매수만 있는 날 ────────────────────────────────────────────────────────
  it('매수만 있는 날은 pnl=0, tradeCount>0', async () => {
    mockRepo.findAllOrdered.mockResolvedValue([
      makeTrade({ side: TradeSide.BUY, quantity: 10, price: 70000, tradedAt: new Date('2026-05-01') }),
    ]);

    const result = await service.dailyStats('user-1', 2026);

    const buyDay = result.find((r) => r.date === '2026-05-01');
    expect(buyDay?.pnl).toBe(0);
    expect(buyDay?.tradeCount).toBe(1);
  });

  // ── 매매 없으면 빈 배열 ───────────────────────────────────────────────────
  it('매매 내역 없으면 빈 배열 반환', async () => {
    mockRepo.findAllOrdered.mockResolvedValue([]);

    const result = await service.dailyStats('user-1', 2026);

    expect(result).toEqual([]);
  });

  // ── 날짜 정렬 ─────────────────────────────────────────────────────────────
  it('결과는 날짜 오름차순으로 정렬된다', async () => {
    mockRepo.findAllOrdered.mockResolvedValue([
      makeTrade({ side: TradeSide.BUY, quantity: 5, price: 60000, tradedAt: new Date('2026-06-01') }),
      makeTrade({ side: TradeSide.SELL, quantity: 5, price: 65000, tradedAt: new Date('2026-06-20') }),
      makeTrade({ side: TradeSide.BUY, quantity: 5, price: 60000, tradedAt: new Date('2026-06-10') }),
    ]);

    const result = await service.dailyStats('user-1', 2026);

    const dates = result.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
  });
});
