import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PositionsService } from './positions.service';

@ApiTags('positions')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @ApiOperation({ summary: '보유 포지션 목록' })
  async findAll(@Headers('x-user-id') userId: string) {
    if (!userId) throw new UnauthorizedException();
    return this.positionsService.findAll(userId);
  }
}
