import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AnalysisReportEntity,
  BacktestResultEntity,
  ChatSessionEntity,
  DocumentEmbeddingEntity,
  PositionEntity,
  StockEntity,
  StrategyEntity,
  TradeEntity,
  UserEntity,
} from '@stock-pile/db-schema';
import { DartModule } from './dart/dart.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { NewsModule } from './news/news.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        database: config.get('POSTGRES_DB', 'stockpile'),
        username: config.get('POSTGRES_USER', 'stockpile'),
        password: config.get('POSTGRES_PASSWORD', 'stockpile'),
        entities: [
          UserEntity,
          StockEntity,
          AnalysisReportEntity,
          DocumentEmbeddingEntity,
          TradeEntity,
          PositionEntity,
          StrategyEntity,
          ChatSessionEntity,
          BacktestResultEntity,
        ],
        synchronize: false,
      }),
    }),
    DartModule,
    NewsModule,
    IndicatorsModule,
    ReportsModule,
  ],
})
export class AppModule {}
