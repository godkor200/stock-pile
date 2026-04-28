import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StocksService } from './stocks.service';

@ApiTags('stocks')
@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get('search')
  @ApiOperation({ summary: '종목 검색 (이름/티커)' })
  @ApiQuery({ name: 'q', description: '검색어' })
  async search(@Query('q') q: string) {
    if (!q?.trim()) throw new BadRequestException('검색어를 입력하세요');
    return this.stocksService.search(q.trim());
  }

  @Get(':ticker')
  @ApiOperation({ summary: '티커로 종목 조회' })
  async findOne(@Param('ticker') ticker: string) {
    const stock = await this.stocksService.findByTicker(ticker.toUpperCase());
    if (!stock) throw new NotFoundException(`종목을 찾을 수 없습니다: ${ticker}`);
    return stock;
  }
}
