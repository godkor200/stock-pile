import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { TradesService } from './trades.service';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { BulkUpdateTradeDto } from './dto/bulk-update-trade.dto';
import { TradeFilterDto } from './dto/trade-filter.dto';

function getUserId(req: Request): string {
  return (req.headers['x-user-id'] as string) ?? 'anonymous';
}

@ApiTags('Trades')
@ApiBearerAuth()
@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get('import-csv/template')
  @ApiOperation({ summary: 'CSV 템플릿 파일 다운로드' })
  downloadTemplate(@Res() res: Response) {
    const csv = [
      'ticker,side,quantity,price,tradedAt,reason,emotion',
      '005930,매수,10,70000,2024-01-15,실적 기대,PLANNED',
      '035720,매도,5,60000,2024-01-20,,',
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="trades_template.csv"');
    res.send('﻿' + csv); // BOM for Excel 한글 호환
  }

  @Post('import-csv')
  @ApiOperation({ summary: 'CSV 파일로 매매 일괄 입력' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importCsv(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('CSV 파일을 첨부해주세요.');
    const userId = getUserId(req);
    return this.tradesService.importFromCsv(userId, file.buffer);
  }

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
