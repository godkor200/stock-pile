import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @ApiOperation({ summary: '종목 분석 리포트 생성 (24h 캐시)' })
  async generate(
    @Body() dto: CreateReportDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) throw new UnauthorizedException();
    return this.reports.generate(userId, dto.ticker.toUpperCase());
  }

  @Get()
  @ApiOperation({ summary: '내 리포트 목록 조회' })
  async findAll(
    @Headers('x-user-id') userId: string,
    @Query('ticker') ticker?: string,
  ) {
    if (!userId) throw new UnauthorizedException();
    return this.reports.findByUser(userId, ticker?.toUpperCase());
  }
}
