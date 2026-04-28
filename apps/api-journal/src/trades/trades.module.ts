import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeEntity } from '@stock-pile/db-schema';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { TradesRepository } from './trades.repository';
import { PositionsModule } from '../positions/positions.module';
import { StocksModule } from '../stocks/stocks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TradeEntity]),
    PositionsModule,
    StocksModule,
  ],
  controllers: [TradesController],
  providers: [TradesService, TradesRepository],
  exports: [TradesService],
})
export class TradesModule {}
