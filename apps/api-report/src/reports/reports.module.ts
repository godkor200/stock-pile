import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisReportEntity, StockEntity } from '@stock-pile/db-schema';
import { DartModule } from '../dart/dart.module';
import { NewsModule } from '../news/news.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { LlmModule } from '../llm/llm.module';
import { VectorModule } from '../vector/vector.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AnalysisReportEntity, StockEntity]),
    DartModule,
    NewsModule,
    IndicatorsModule,
    LlmModule,
    VectorModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
