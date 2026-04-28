import { Module } from '@nestjs/common';
import { DartAdapter } from './dart.adapter';
import { DartService } from './dart.service';
import { RedisCacheService } from '../common/redis-cache.service';

@Module({
  providers: [DartAdapter, DartService, RedisCacheService],
  exports: [DartService],
})
export class DartModule {}
