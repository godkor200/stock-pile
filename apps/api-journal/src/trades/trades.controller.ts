import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { TradesService } from './trades.service';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { BulkUpdateTradeDto } from './dto/bulk-update-trade.dto';
import { TradeFilterDto } from './dto/trade-filter.dto';

/**
 * 헤더 Authorization: Bearer <userId> 를 userId 로 사용하는 stub guard.
 * 실제 인증 모듈은 별도 태스크에서 구현.
 */
function getUserId(req: Request): string {
  const auth = req.headers['authorization'];
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return 'anonymous';
}

@ApiTags('Trades')
@ApiBearerAuth()
@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  @ApiOperation({ summary: '매매 목록 조회 (페이지네이션, 필터)' })
  async findAll(@Req() req: Request, @Query() filter: TradeFilterDto) {
    const userId = getUserId(req);
    return this.tradesService.findAll(userId, filter);
  }

  @Get('missing-context')
  @ApiOperation({ summary: 'reason 또는 emotion이 없는 매매 조회' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['by_ticker', 'by_date', 'by_side'] })
  async findMissingContext(
    @Req() req: Request,
    @Query('groupBy') groupBy?: string,
  ) {
    const userId = getUserId(req);
    return this.tradesService.findMissingContext(userId, groupBy);
  }

  @Get('stats/quick')
  @ApiOperation({ summary: '빠른 집계: tradeCount, winRate, totalRealizedPnl' })
  async quickStats(@Req() req: Request) {
    const userId = getUserId(req);
    return this.tradesService.quickStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '단건 매매 조회' })
  async findOne(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = getUserId(req);
    return this.tradesService.findOne(id, userId);
  }

  @Patch('bulk')
  @ApiOperation({ summary: '여러 매매 일괄 수정' })
  async bulkUpdate(@Req() req: Request, @Body() dto: BulkUpdateTradeDto) {
    const userId = getUserId(req);
    return this.tradesService.bulkUpdate(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '단건 매매 수정 (reason/emotion/tags/quantity/price)' })
  async update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTradeDto,
  ) {
    const userId = getUserId(req);
    return this.tradesService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '매매 삭제' })
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = getUserId(req);
    await this.tradesService.remove(id, userId);
  }
}
