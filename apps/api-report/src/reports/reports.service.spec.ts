import { Repository } from 'typeorm';
import { AnalysisReportEntity, StockEntity } from '@stock-pile/db-schema';
import { Verdict } from '@stock-pile/shared-types';
import { ReportsService } from './reports.service';
import { DartService } from '../dart/dart.service';
import { NewsService } from '../news/news.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { LlmService } from '../llm/llm.service';
import { VectorStoreService } from '../vector/vector-store.service';

function makeReport(
  overrides: Partial<AnalysisReportEntity> = {},
): AnalysisReportEntity {
  const r = new AnalysisReportEntity();
  r.id = Math.random().toString(36).slice(2);
  r.userId = 'user-1';
  r.ticker = '005930';
  r.verdict = Verdict.BUY;
  r.claudeAnalysis = '{}';
  r.generatedAt = new Date();
  return Object.assign(r, overrides);
}

describe('ReportsService', () => {
  let service: ReportsService;
  let reportRepo: jest.Mocked<Pick<Repository<AnalysisReportEntity>, 'find' | 'findOne' | 'save' | 'create' | 'createQueryBuilder'>>;

  beforeEach(() => {
    reportRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as typeof reportRepo;

    service = new ReportsService(
      reportRepo as unknown as Repository<AnalysisReportEntity>,
      {} as Repository<StockEntity>,
      {} as DartService,
      {} as NewsService,
      {} as IndicatorsService,
      {} as LlmService,
      {} as VectorStoreService,
    );

    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────
  // findByUser — 종목별 최신 1개 중복 제거
  // ──────────────────────────────────────────────────────────
  describe('findByUser', () => {
    it('같은 종목 리포트가 여러 개일 때 최신 1개만 반환한다', async () => {
      const older = makeReport({
        ticker: '005930',
        verdict: Verdict.HOLD,
        generatedAt: new Date('2026-01-01'),
      });
      const newer = makeReport({
        ticker: '005930',
        verdict: Verdict.BUY,
        generatedAt: new Date('2026-05-01'),
      });
      // find는 DESC 정렬이므로 newer가 먼저 옴
      (reportRepo.find as jest.Mock).mockResolvedValue([newer, older]);

      const result = await service.findByUser('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].verdict).toBe(Verdict.BUY);
      expect(result[0].generatedAt).toEqual(new Date('2026-05-01'));
    });

    it('종목이 다르면 각각 1개씩 반환한다', async () => {
      const samsung = makeReport({ ticker: '005930', verdict: Verdict.BUY });
      const sk = makeReport({ ticker: '000660', verdict: Verdict.HOLD });
      (reportRepo.find as jest.Mock).mockResolvedValue([samsung, sk]);

      const result = await service.findByUser('user-1');

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.ticker)).toContain('005930');
      expect(result.map((r) => r.ticker)).toContain('000660');
    });

    it('리포트가 없으면 빈 배열을 반환한다', async () => {
      (reportRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.findByUser('user-1');

      expect(result).toEqual([]);
    });

    it('ticker 필터를 전달하면 해당 종목만 조회한다', async () => {
      const report = makeReport({ ticker: '005930' });
      (reportRepo.find as jest.Mock).mockResolvedValue([report]);

      await service.findByUser('user-1', '005930');

      expect(reportRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', ticker: '005930' } }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // findHistory — 종목별 전체 이력 반환
  // ──────────────────────────────────────────────────────────
  describe('findHistory', () => {
    it('종목 이력을 최신순으로 반환한다', async () => {
      const r1 = makeReport({ generatedAt: new Date('2026-05-01'), verdict: Verdict.BUY });
      const r2 = makeReport({ generatedAt: new Date('2026-03-01'), verdict: Verdict.HOLD });
      const r3 = makeReport({ generatedAt: new Date('2026-01-01'), verdict: Verdict.SELL });
      (reportRepo.find as jest.Mock).mockResolvedValue([r1, r2, r3]);

      const result = await service.findHistory('user-1', '005930');

      expect(result).toHaveLength(3);
      expect(result[0].verdict).toBe(Verdict.BUY);
      expect(result[2].verdict).toBe(Verdict.SELL);
    });

    it('이력 조회는 중복 제거하지 않고 전부 반환한다', async () => {
      const reports = [
        makeReport({ verdict: Verdict.BUY }),
        makeReport({ verdict: Verdict.BUY }),
        makeReport({ verdict: Verdict.HOLD }),
      ];
      (reportRepo.find as jest.Mock).mockResolvedValue(reports);

      const result = await service.findHistory('user-1', '005930');

      expect(result).toHaveLength(3);
    });

    it('이력이 없으면 빈 배열을 반환한다', async () => {
      (reportRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.findHistory('user-1', '005930');

      expect(result).toEqual([]);
    });
  });
});
