import { Module } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { RedisCacheService } from '../common/redis-cache.service';

@Module({
  providers: [IndicatorsService, RedisCacheService],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
