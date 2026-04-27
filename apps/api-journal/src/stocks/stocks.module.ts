import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockEntity } from '@stock-pile/db-schema';
import { StocksService } from './stocks.service';

@Module({
  imports: [TypeOrmModule.forFeature([StockEntity])],
  providers: [StocksService],
  exports: [StocksService],
})
export class StocksModule {}
