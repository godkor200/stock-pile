import {
  IsString,
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Emotion } from '@stock-pile/shared-types';

export class UpdateTradeDto {
  @ApiPropertyOptional({ example: '기술적 돌파 후 익절' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ enum: Emotion })
  @IsOptional()
  @IsEnum(Emotion)
  emotion?: Emotion;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ example: 72000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;
}
