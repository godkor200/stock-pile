import { Test, TestingModule } from '@nestjs/testing';
import { NewsService } from './news.service';
import { NaverNewsAdapter } from './news.adapter';
import { RedisCacheService } from '../common/redis-cache.service';
import { NaverNewsItem } from './interfaces/naver-response.interface';

const mockNaverAdapter = {
  search: jest.fn(),
};

const mockRedisCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

function makeItem(
  title: string,
  daysAgo = 0,
): NaverNewsItem {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    title,
    originallink: `https://example.com/${title}`,
    link: `https://example.com/${title}`,
    description: `Description for ${title}`,
    pubDate: date.toUTCString(),
  };
}

describe('NewsService', () => {
  let service: NewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: NaverNewsAdapter, useValue: mockNaverAdapter },
        { provide: RedisCacheService, useValue: mockRedisCacheService },
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
    jest.clearAllMocks();
  });

  describe('searchNews - 광고성 뉴스 필터링', () => {
    it('광고 키워드가 포함된 뉴스를 제외한다', async () => {
      const items: NaverNewsItem[] = [
        makeItem('삼성전자 실적 발표 예정', 1),
        makeItem('삼성전자 매수 추천 목표가 상향', 1),  // should be filtered
        makeItem('삼성전자 반도체 수요 회복세', 1),
        makeItem('삼성전자 투자 광고 배너', 1),          // should be filtered
        makeItem('삼성전자 목표가 100000원', 1),          // should be filtered
      ];

      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockNaverAdapter.search.mockResolvedValueOnce({ items, total: 5 });
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.searchNews('삼성전자', 7);

      expect(result.length).toBe(2);
      expect(result.every((item) => !item.title.includes('매수'))).toBe(true);
      expect(result.every((item) => !item.title.includes('목표가'))).toBe(true);
      expect(result.every((item) => !item.title.includes('광고'))).toBe(true);
    });

    it('추천 키워드가 포함된 뉴스를 제외한다', async () => {
      const items: NaverNewsItem[] = [
        makeItem('삼성전자 강력 추천 종목', 1),  // should be filtered
        makeItem('삼성전자 4분기 전망', 1),
      ];

      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockNaverAdapter.search.mockResolvedValueOnce({ items, total: 2 });
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.searchNews('삼성전자', 7);

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('삼성전자 4분기 전망');
    });
  });

  describe('searchNews - 중복 제거', () => {
    it('제목 첫 20자가 동일한 뉴스는 중복으로 제거한다', async () => {
      const baseTitle = '삼성전자 1분기 실적 호조 예상 추가 내용 A';
      const dupTitle  = '삼성전자 1분기 실적 호조 예상 추가 내용 B';

      const items: NaverNewsItem[] = [
        makeItem(baseTitle, 1),
        makeItem(dupTitle, 2),  // same first 20 chars → deduped
        makeItem('LG에너지솔루션 배터리 수출', 1),  // different title
      ];

      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockNaverAdapter.search.mockResolvedValueOnce({ items, total: 3 });
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.searchNews('삼성전자', 7);

      // baseTitle and dupTitle share first 20 chars; only one survives
      expect(result.length).toBe(2);
    });

    it('완전히 동일한 제목의 뉴스를 중복 제거한다', async () => {
      const title = '삼성전자 갤럭시 신제품 발표';
      const items: NaverNewsItem[] = [
        makeItem(title, 1),
        makeItem(title, 1),
        makeItem(title, 2),
      ];

      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockNaverAdapter.search.mockResolvedValueOnce({ items, total: 3 });
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.searchNews('삼성전자', 7);

      expect(result.length).toBe(1);
    });
  });

  describe('searchNews - 날짜 필터링', () => {
    it('days 범위를 벗어난 오래된 뉴스를 제외한다', async () => {
      const items: NaverNewsItem[] = [
        makeItem('최신 뉴스', 1),
        makeItem('오래된 뉴스', 30),  // 30 days ago, beyond 7-day window
      ];

      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockNaverAdapter.search.mockResolvedValueOnce({ items, total: 2 });
      mockRedisCacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.searchNews('삼성전자', 7);

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('최신 뉴스');
    });
  });

  describe('searchNews - 오류 처리', () => {
    it('API 실패 시 빈 배열을 반환한다', async () => {
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockNaverAdapter.search.mockRejectedValueOnce(new Error('Network Error'));

      const result = await service.searchNews('삼성전자', 7);

      expect(result).toEqual([]);
    });

    it('adapter가 null을 반환하면 빈 배열을 반환한다', async () => {
      mockRedisCacheService.get.mockResolvedValueOnce(null);
      mockNaverAdapter.search.mockResolvedValueOnce(null);

      const result = await service.searchNews('삼성전자', 7);

      expect(result).toEqual([]);
    });
  });

  describe('searchNews - 캐시', () => {
    it('캐시 히트 시 adapter를 호출하지 않는다', async () => {
      const cached: NaverNewsItem[] = [makeItem('캐시된 뉴스', 1)];
      mockRedisCacheService.get.mockResolvedValueOnce(cached);

      const result = await service.searchNews('삼성전자', 7);

      expect(result).toEqual(cached);
      expect(mockNaverAdapter.search).not.toHaveBeenCalled();
    });
  });
});
