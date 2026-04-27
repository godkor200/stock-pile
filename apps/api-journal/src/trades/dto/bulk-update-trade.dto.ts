import { IsArray, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateTradeDto } from './update-trade.dto';

export class BulkUpdateTradeDto {
  @ApiProperty({ type: [String], example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  tradeIds: string[];

  @ApiProperty({ type: UpdateTradeDto })
  @ValidateNested()
  @Type(() => UpdateTradeDto)
  patch: UpdateTradeDto;
}
