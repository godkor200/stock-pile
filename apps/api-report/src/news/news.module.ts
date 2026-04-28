import { Module } from '@nestjs/common';
import { NaverNewsAdapter } from './news.adapter';
import { NewsService } from './news.service';
import { RedisCacheService } from '../common/redis-cache.service';

@Module({
  providers: [NaverNewsAdapter, NewsService, RedisCacheService],
  exports: [NewsService],
})
export class NewsModule {}
