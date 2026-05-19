import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { CoachingService } from './coaching.service';

function getUserId(req: Request): string {
  return (req.headers['x-user-id'] as string) ?? 'anonymous';
}

@ApiTags('Coaching')
@Controller('coaching')
export class CoachingController {
  constructor(private readonly coachingService: CoachingService) {}

  @Get('monthly')
  @ApiOperation({ summary: '월간 코칭 리포트 — 매매 패턴 분석 및 개선 제안' })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'month', required: false, type: Number, example: 5 })
  async getMonthlyCoaching(
    @Req() req: Request,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const userId = getUserId(req);
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    return this.coachingService.getMonthlyCoaching(userId, y, m);
  }
}
