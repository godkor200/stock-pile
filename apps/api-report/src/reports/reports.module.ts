import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisReportEntity } from '@stock-pile/db-schema';
import { DartModule } from '../dart/dart.module';
import { NewsModule } from '../news/news.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AnalysisReportEntity]),
    DartModule,
    NewsModule,
    IndicatorsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
