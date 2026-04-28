import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  UserEntity,
  StockEntity,
  TradeEntity,
  PositionEntity,
  AnalysisReportEntity,
  ChatSessionEntity,
} from '@stock-pile/db-schema';
import { TradesModule } from './trades/trades.module';
import { PositionsModule } from './positions/positions.module';
import { StocksModule } from './stocks/stocks.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        database: config.get('POSTGRES_DB', 'stockpile'),
        username: config.get('POSTGRES_USER', 'stockpile'),
        password: config.get('POSTGRES_PASSWORD', 'stockpile'),
        entities: [UserEntity, StockEntity, TradeEntity, PositionEntity, AnalysisReportEntity, ChatSessionEntity],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    TradesModule,
    PositionsModule,
    StocksModule,
    ChatModule,
  ],
})
export class AppModule {}
