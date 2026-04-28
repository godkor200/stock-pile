import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  UserEntity,
  StockEntity,
  AnalysisReportEntity,
} from '@stock-pile/db-schema';
import { DartModule } from './dart/dart.module';
import { NewsModule } from './news/news.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { ReportsModule } from './reports/reports.module';

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
        entities: [UserEntity, StockEntity, AnalysisReportEntity],
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
