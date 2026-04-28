import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockEntity } from '@stock-pile/db-schema';
import { RedisCacheService } from '../common/redis-cache.service';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([StockEntity])],
  controllers: [StocksController],
  providers: [StocksService, RedisCacheService],
  exports: [StocksService],
})
export class StocksModule {}
