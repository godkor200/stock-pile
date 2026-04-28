import { Test, TestingModule } from '@nestjs/testing';
import { IndicatorsService } from './indicators.service';
import { RedisCacheService } from '../common/redis-cache.service';

// Mock axios
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockRedisCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

// Generate synthetic OHLCV-like close prices for testing
function generateCloses(count: number, start = 100, volatility = 5): number[] {
  const closes: number[] = [start];
  for (let i = 1; i < count; i++) {
    const change = (Math.random() - 0.5) * volatility;
    closes.push(Math.max(1, closes[i - 1] + change));
  }
  return closes;
}

// Trending upward closes (for RSI > 50 verification)
function generateTrendingUpCloses(count: number): number[] {
  const closes: number[] = [100];
  for (let i = 1; i < count; i++) {
    closes.push(closes[i - 1] + 1); // always going up
  }
  return closes;
}

// Trending downward closes (for RSI < 50 verification)
function generateTrendingDownCloses(count: number): number[] {
  const closes: number[] = [200];
  for (let i = 1; i < count; i++) {
    closes.push(Math.max(1, closes[i - 1] - 1)); // always going down
  }
  return closes;
}

describe('IndicatorsService', () => {
  let service: IndicatorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndicatorsService,
        { provide: RedisCacheService, useValue: mockRedisCacheService },
      ],
    }).compile();

    service = module.get<IndicatorsService>(IndicatorsService);
    jest.clearAllMocks();
  });

  describe('calculateRsi', () => {
    it('RSI 값은 항상 0~100 범위여야 한다', () => {
      const closes = generateCloses(100);
      const rsi = service.calculateRsi(closes, 14);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('상승 추세에서 RSI는 50보다 높다', () => {
      const closes = generateTrendingUpCloses(50);
      const rsi = service.calculateRsi(closes, 14);
      expect(rsi).toBeGreaterThan(50);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('하락 추세에서 RSI는 50보다 낮다', () => {
      const closes = generateTrendingDownCloses(50);
      const rsi = service.calculateRsi(closes, 14);
      expect(rsi).toBeLessThan(50);
      expect(rsi).toBeGreaterThanOrEqual(0);
    });

    it('데이터가 부족할 때 0을 반환한다', () => {
      const closes = generateCloses(5); // less than period=14
      const rsi = service.calculateRsi(closes, 14);
      expect(rsi).toBe(0);
    });
  });

  describe('calculateMacd', () => {
    it('충분한 데이터에서 MACD 객체를 반환한다', () => {
      const closes = generateCloses(60);
      const macd = service.calculateMacd(closes);
      expect(macd).toHaveProperty('value');
      expect(macd).toHaveProperty('signal');
      expect(macd).toHaveProperty('histogram');
    });

    it('MACD histogram = value - signal', () => {
      const closes = generateCloses(60);
      const macd = service.calculateMacd(closes);
      expect(macd.histogram).toBeCloseTo(macd.value - macd.signal, 5);
    });

    it('데이터가 부족할 때 0 객체를 반환한다', () => {
      const closes = generateCloses(10); // less than slow period 26
      const macd = service.calculateMacd(closes);
      expect(macd).toEqual({ value: 0, signal: 0, histogram: 0 });
    });
  });

  describe('calculateMa', () => {
    it('단순 이동평균을 올바르게 계산한다', () => {
      const closes = [10, 20, 30, 40, 50];
      const ma5 = service.calculateMa(closes, 5);
      expect(ma5).toBe(30); // (10+20+30+40+50)/5
    });

    it('MA5: 마지막 5개 값의 평균', () => {
      const closes = [100, 110, 120, 130, 140, 150];
      const ma5 = service.calculateMa(closes, 5);
      expect(ma5).toBe(130); // (110+120+130+140+150)/5
    });

    it('데이터가 period보다 적으면 0을 반환한다', () => {
      const closes = [100, 110];
      const ma20 = service.calculateMa(closes, 20);
      expect(ma20).toBe(0);
    });

    it('MA60: 60개 이상 데이터에서 이동평균 계산', () => {
      const closes = Array.from({ length: 70 }, (_, i) => 100 + i);
      const ma60 = service.calculateMa(closes, 60);
      // Last 60 values: 10..69 → avg = (10+69)/2 = 39.5 + 100 = 139.5
      expect(ma60).toBeCloseTo(139.5, 1);
    });
  });

  describe('getOhlcv', () => {
    it('Yahoo Finance API 응답을 OHLCV 배열로 변환한다', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: {
          chart: {
            result: [
              {
                meta: { symbol: '005930.KS' },
                timestamp: [now - 86400, now],
                indicators: {
                  quote: [
                    {
                      open: [70000, 71000],
                      high: [71000, 72000],
                      low: [69000, 70000],
                      close: [70500, 71500],
                      volume: [1000000, 1200000],
                    },
                  ],
                },
              },
            ],
            error: null,
          },
        },
      });
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.getOhlcv('005930', 5);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        open: 70000,
        high: 71000,
        low: 69000,
        close: 70500,
        volume: 1000000,
      });
    });

    it('API 실패 시 빈 배열을 반환한다', async () => {
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockedAxios.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network Error'));

      const result = await service.getOhlcv('005930', 5);

      expect(result).toEqual([]);
    });

    it('한국 주식은 .KS suffix를 붙여서 호출한다', async () => {
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: { chart: { result: null, error: null } },
      });

      await service.getOhlcv('005930', 5);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('005930.KS'),
        expect.any(Object),
      );
    });

    it('나스닥 주식은 suffix 없이 호출한다', async () => {
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: { chart: { result: null, error: null } },
      });

      await service.getOhlcv('AAPL', 5);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/AAPL'),
        expect.any(Object),
      );
    });

    it('캐시 히트 시 axios를 호출하지 않는다', async () => {
      const cached = [{ date: '2024-01-01', open: 100, high: 105, low: 98, close: 103, volume: 100000 }];
      mockRedisCacheService.get.mockResolvedValueOnce(cached);

      const result = await service.getOhlcv('005930', 5);

      expect(result).toEqual(cached);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('getIndicatorSummary', () => {
    it('OHLCV 데이터가 없으면 null을 반환한다', async () => {
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: { chart: { result: null, error: null } },
      });

      const result = await service.getIndicatorSummary('INVALID');

      expect(result).toBeNull();
    });

    it('충분한 데이터로 IndicatorSummary를 반환한다', async () => {
      const closes90 = generateCloses(90, 70000, 1000);
      const now = Math.floor(Date.now() / 1000);
      const timestamps = closes90.map((_, i) => now - (90 - i) * 86400);

      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: {
          chart: {
            result: [
              {
                meta: { symbol: '005930.KS' },
                timestamp: timestamps,
                indicators: {
                  quote: [
                    {
                      open: closes90.map((c) => c * 0.99),
                      high: closes90.map((c) => c * 1.01),
                      low: closes90.map((c) => c * 0.98),
                      close: closes90,
                      volume: closes90.map(() => 1000000),
                    },
                  ],
                },
              },
            ],
            error: null,
          },
        },
      });
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.getIndicatorSummary('005930');

      expect(result).not.toBeNull();
      expect(result?.ticker).toBe('005930');
      expect(result?.rsi14).toBeGreaterThanOrEqual(0);
      expect(result?.rsi14).toBeLessThanOrEqual(100);
      expect(result?.macd).toHaveProperty('value');
      expect(result?.macd).toHaveProperty('signal');
      expect(result?.macd).toHaveProperty('histogram');
      expect(result?.ma).toHaveProperty('ma5');
      expect(result?.ma).toHaveProperty('ma20');
      expect(result?.ma).toHaveProperty('ma60');
      expect(result?.closes30d).toHaveLength(30);
    });
  });
});
