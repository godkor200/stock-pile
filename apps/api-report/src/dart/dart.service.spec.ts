import { Test, TestingModule } from '@nestjs/testing';
import { DartService } from './dart.service';
import { DartAdapter } from './dart.adapter';
import { RedisCacheService } from '../common/redis-cache.service';
import { DartCompanyResponse } from './interfaces/dart-response.interface';

const mockDartAdapter = {
  getCompanyInfo: jest.fn(),
  getFinancialStatements: jest.fn(),
  getRecentDisclosures: jest.fn(),
};

const mockRedisCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('DartService', () => {
  let service: DartService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DartService,
        { provide: DartAdapter, useValue: mockDartAdapter },
        { provide: RedisCacheService, useValue: mockRedisCacheService },
      ],
    }).compile();

    service = module.get<DartService>(DartService);
    jest.clearAllMocks();
  });

  describe('getCompanyInfo', () => {
    it('정상 응답을 파싱하여 반환한다', async () => {
      const mockResponse: Partial<DartCompanyResponse> = {
        status: '000',
        message: '정상',
        corp_name: '삼성전자',
        stock_code: '005930',
        sector: '전자부품 제조업',
      };

      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockDartAdapter.getCompanyInfo.mockResolvedValueOnce(mockResponse);
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.getCompanyInfo('005930');

      expect(result).toEqual(mockResponse);
      expect(result?.corp_name).toBe('삼성전자');
      expect(result?.stock_code).toBe('005930');
      expect(mockDartAdapter.getCompanyInfo).toHaveBeenCalledWith('005930');
      expect(mockRedisCacheService.set).toHaveBeenCalledWith(
        'dart:companyInfo:005930',
        mockResponse,
        3600,
      );
    });

    it('API 실패 시 null을 반환한다 (graceful degradation)', async () => {
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      // First call fails, retry also fails
      mockDartAdapter.getCompanyInfo
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'));

      const result = await service.getCompanyInfo('005930');

      expect(result).toBeNull();
      expect(mockDartAdapter.getCompanyInfo).toHaveBeenCalledTimes(2);
    });

    it('두 번째 호출에서는 Redis 캐시를 사용한다 (axios 호출 1번만)', async () => {
      const mockResponse: Partial<DartCompanyResponse> = {
        status: '000',
        corp_name: '삼성전자',
        stock_code: '005930',
      };

      // First call: cache miss, fetch from API
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockDartAdapter.getCompanyInfo.mockResolvedValueOnce(mockResponse);
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      await service.getCompanyInfo('005930');

      // Second call: cache hit
      mockRedisCacheService.get.mockResolvedValueOnce(mockResponse);

      const secondResult = await service.getCompanyInfo('005930');

      expect(secondResult).toEqual(mockResponse);
      // axios (adapter) called only once total
      expect(mockDartAdapter.getCompanyInfo).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFinancialStatements', () => {
    it('정상 응답을 반환한다', async () => {
      const mockResponse = {
        status: '000',
        message: '정상',
        list: [
          {
            account_nm: '매출액',
            thstrm_amount: '300,000,000',
          },
        ],
      };

      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockDartAdapter.getFinancialStatements.mockResolvedValueOnce(mockResponse);
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.getFinancialStatements('005930', 2023);

      expect(result).toEqual(mockResponse);
      expect(result?.list?.[0].account_nm).toBe('매출액');
    });

    it('API 실패 시 null을 반환한다', async () => {
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockDartAdapter.getFinancialStatements
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'));

      const result = await service.getFinancialStatements('005930', 2023);

      expect(result).toBeNull();
    });
  });

  describe('getRecentDisclosures', () => {
    it('정상 응답을 반환한다', async () => {
      const mockResponse = {
        status: '000',
        message: '정상',
        list: [
          {
            rcept_no: '20231201000001',
            report_nm: '분기보고서',
            rcept_dt: '20231201',
          },
        ],
      };

      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockDartAdapter.getRecentDisclosures.mockResolvedValueOnce(mockResponse);
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.getRecentDisclosures('005930', 30);

      expect(result).toEqual(mockResponse);
      expect(result?.list?.[0].report_nm).toBe('분기보고서');
    });
  });
});
