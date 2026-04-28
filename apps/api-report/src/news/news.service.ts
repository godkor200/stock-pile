import { Injectable, Logger } from '@nestjs/common';
import { NaverNewsAdapter } from './news.adapter';
import { RedisCacheService } from '../common/redis-cache.service';
import { NaverNewsItem } from './interfaces/naver-response.interface';

const CACHE_TTL = 1800;
const AD_KEYWORDS = ['매수', '목표가', '추천', '광고'];
const DEDUP_PREFIX_LEN = 20;

function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, '');
}

function isAdNews(title: string): boolean {
  return AD_KEYWORDS.some((kw) => title.includes(kw));
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly naverAdapter: NaverNewsAdapter,
    private readonly cache: RedisCacheService,
  ) {}

  async searchNews(
    stockName: string,
    days: number,
  ): Promise<NaverNewsItem[]> {
    const key = `news:search:${stockName}:${days}`;
    const cached = await this.cache.get<NaverNewsItem[]>(key);
    if (cached !== null) {
      this.logger.debug(`Cache hit: ${key}`);
      return cached;
    }

    try {
      const response = await this.naverAdapter.search(stockName, 100);
      if (response === null || !response.items) {
        return [];
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const seen = new Set<string>();
      const results: NaverNewsItem[] = [];

      for (const item of response.items) {
        const plainTitle = stripHtml(item.title);
        const pubDate = new Date(item.pubDate);

        // Filter by date
        if (pubDate < cutoff) continue;

        // Filter ad news
        if (isAdNews(plainTitle)) continue;

        // Dedup by first 20 chars of title
        const dedupKey = plainTitle.slice(0, DEDUP_PREFIX_LEN);
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        results.push({ ...item, title: plainTitle });
      }

      await this.cache.set(key, results, CACHE_TTL);
      return results;
    } catch (err) {
      this.logger.error(
        `searchNews failed for stockName=${stockName}`,
        err,
      );
      return [];
    }
  }
}
