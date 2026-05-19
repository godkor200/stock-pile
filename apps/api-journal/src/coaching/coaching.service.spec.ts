import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TradeEntity } from '@stock-pile/db-schema';
import { TradeSide, TradeSource, Emotion } from '@stock-pile/shared-types';
import { CoachingService } from './coaching.service';

function makeTrade(overrides: Partial<TradeEntity> = {}): TradeEntity {
  const t = new TradeEntity();
  t.id = 'trade-uuid-1';
  t.userId = 'user-1';
  t.ticker = '005930';
  t.side = TradeSide.BUY;
  t.quantity = 10;
  t.price = 70000;
  t.tradedAt = new Date('2026-05-01');
  t.reason = '실적 기대';
  t.emotion = Emotion.PLANNED;
  t.tags = [];
  t.source = TradeSource.CHATBOT;
  t.createdAt = new Date();
  t.stock = { ticker: '005930', name: '삼성전자' } as never;
  return Object.assign(t, overrides);
}

describe('CoachingService', () => {
  let service: CoachingService;
  let mockTradeRepo: jest.Mocked<Pick<Repository<TradeEntity>, 'createQueryBuilder'>>;
  let mockDataSource: jest.Mocked<Pick<DataSource, 'createQueryBuilder'>>;
  let mockConfig: jest.Mocked<Pick<ConfigService, 'get'>>;

  // createQueryBuilder 체이닝 헬퍼
  function makeQb(trades: TradeEntity[]) {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(trades),
    };
    return qb;
  }

  function makePnlQb(pnl: number) {
    const qb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: String(pnl) }),
    };
    return qb;
  }

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const map: Record<string, unknown> = {
          GROQ_MODEL: 'llama-3.1-8b-instant',
          GROQ_API_KEY: 'test-key',
          ANTHROPIC_API_KEY: '',
        };
        return map[key] ?? fallback;
      }),
    } as never;

    mockTradeRepo = {
      createQueryBuilder: jest.fn(),
    } as never;

    mockDataSource = {
      createQueryBuilder: jest.fn(),
    } as never;

    service = new CoachingService(
      mockTradeRepo as unknown as Repository<TradeEntity>,
      mockDataSource as unknown as DataSource,
      mockConfig as unknown as ConfigService,
    );

    // LLM 호출 mock (실제 네트워크 호출 방지)
    jest.spyOn(service as unknown as { callLlm: () => Promise<unknown> }, 'callLlm')
      .mockResolvedValue({
        summary: '테스트 요약',
        strengths: ['잘한 점'],
        improvements: ['개선할 점'],
        nextMonthTips: ['제안'],
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ----------------------------------------------------------------
  // 1. 매매 기록 없을 때 빈 코칭 반환
  // ----------------------------------------------------------------
  it('매매 기록이 없으면 빈 코칭 메시지를 반환한다', async () => {
    mockTradeRepo.createQueryBuilder = jest.fn().mockReturnValue(makeQb([]));
    mockDataSource.createQueryBuilder = jest.fn().mockReturnValue(makePnlQb(0));

    const result = await service.getMonthlyCoaching('user-1', 2026, 5);

    expect(result.stats.totalTrades).toBe(0);
    expect(result.coaching.summary).toBe('이달 매매 기록이 없습니다.');
  });

  // ----------------------------------------------------------------
  // 2. BUY/SELL 카운트 집계
  // ----------------------------------------------------------------
  it('BUY/SELL 카운트를 정확히 집계한다', async () => {
    const trades = [
      makeTrade({ side: TradeSide.BUY }),
      makeTrade({ side: TradeSide.BUY }),
      makeTrade({ side: TradeSide.SELL }),
    ];
    mockTradeRepo.createQueryBuilder = jest.fn().mockReturnValue(makeQb(trades));
    mockDataSource.createQueryBuilder = jest.fn().mockReturnValue(makePnlQb(0));

    const result = await service.getMonthlyCoaching('user-1', 2026, 5);

    expect(result.stats.totalTrades).toBe(3);
    expect(result.stats.buyCount).toBe(2);
    expect(result.stats.sellCount).toBe(1);
  });

  // ----------------------------------------------------------------
  // 3. 많이 거래한 종목 Top3 (내림차순, 최대 3개)
  // ----------------------------------------------------------------
  it('많이 거래한 종목을 내림차순으로 최대 3개 반환한다', async () => {
    const trades = [
      makeTrade({ ticker: '005930' }),
      makeTrade({ ticker: '005930' }),
      makeTrade({ ticker: '005930' }),
      makeTrade({ ticker: '035720', stock: { ticker: '035720', name: '카카오' } as never }),
      makeTrade({ ticker: '035720', stock: { ticker: '035720', name: '카카오' } as never }),
      makeTrade({ ticker: '000660', stock: { ticker: '000660', name: 'SK하이닉스' } as never }),
      makeTrade({ ticker: '051910', stock: { ticker: '051910', name: 'LG화학' } as never }),
    ];
    mockTradeRepo.createQueryBuilder = jest.fn().mockReturnValue(makeQb(trades));
    mockDataSource.createQueryBuilder = jest.fn().mockReturnValue(makePnlQb(0));

    const result = await service.getMonthlyCoaching('user-1', 2026, 5);

    expect(result.stats.topTickers).toHaveLength(3);
    expect(result.stats.topTickers[0].ticker).toBe('005930');
    expect(result.stats.topTickers[0].count).toBe(3);
    expect(result.stats.topTickers[1].ticker).toBe('035720');
    expect(result.stats.topTickers[1].count).toBe(2);
  });

  // ----------------------------------------------------------------
  // 4. 감정 분포 집계
  // ----------------------------------------------------------------
  it('감정 분포를 정확히 집계한다', async () => {
    const trades = [
      makeTrade({ emotion: Emotion.PLANNED }),
      makeTrade({ emotion: Emotion.PLANNED }),
      makeTrade({ emotion: Emotion.FOMO }),
      makeTrade({ emotion: null }),
    ];
    mockTradeRepo.createQueryBuilder = jest.fn().mockReturnValue(makeQb(trades));
    mockDataSource.createQueryBuilder = jest.fn().mockReturnValue(makePnlQb(0));

    const result = await service.getMonthlyCoaching('user-1', 2026, 5);

    expect(result.stats.emotionDistribution['PLANNED']).toBe(2);
    expect(result.stats.emotionDistribution['FOMO']).toBe(1);
    expect(result.stats.emotionDistribution['null']).toBeUndefined();
  });

  // ----------------------------------------------------------------
  // 5. reason 기록률 계산
  // ----------------------------------------------------------------
  it('reason 기록률을 정확히 계산한다', async () => {
    const trades = [
      makeTrade({ reason: '실적 기대' }),
      makeTrade({ reason: '기술적 신호' }),
      makeTrade({ reason: null }),
      makeTrade({ reason: null }),
    ];
    mockTradeRepo.createQueryBuilder = jest.fn().mockReturnValue(makeQb(trades));
    mockDataSource.createQueryBuilder = jest.fn().mockReturnValue(makePnlQb(0));

    const result = await service.getMonthlyCoaching('user-1', 2026, 5);

    // 2/4 = 0.5
    expect(result.stats.reasonRate).toBe(0.5);
  });

  // ----------------------------------------------------------------
  // 6. 실현 손익 반영
  // ----------------------------------------------------------------
  it('positions 테이블의 실현 손익을 stats에 반영한다', async () => {
    mockTradeRepo.createQueryBuilder = jest.fn().mockReturnValue(makeQb([makeTrade()]));
    mockDataSource.createQueryBuilder = jest.fn().mockReturnValue(makePnlQb(150000));

    const result = await service.getMonthlyCoaching('user-1', 2026, 5);

    expect(result.stats.totalRealizedPnl).toBe(150000);
  });

  // ----------------------------------------------------------------
  // 7. 응답에 year, month 포함
  // ----------------------------------------------------------------
  it('응답에 요청한 year, month가 포함된다', async () => {
    mockTradeRepo.createQueryBuilder = jest.fn().mockReturnValue(makeQb([]));
    mockDataSource.createQueryBuilder = jest.fn().mockReturnValue(makePnlQb(0));

    const result = await service.getMonthlyCoaching('user-1', 2026, 3);

    expect(result.year).toBe(2026);
    expect(result.month).toBe(3);
  });
});
