import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Emotion, TradeSide, TradeSource } from '@stock-pile/shared-types';

export class TradeFilterDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'tradedAt' })
  @IsOptional()
  @IsString()
  sort?: string = 'tradedAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], example: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ example: 'SAMSUNG' })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiPropertyOptional({ enum: TradeSide })
  @IsOptional()
  @IsEnum(TradeSide)
  side?: TradeSide;

  @ApiPropertyOptional({ enum: Emotion })
  @IsOptional()
  @IsEnum(Emotion)
  emotion?: Emotion;

  @ApiPropertyOptional({ enum: TradeSource })
  @IsOptional()
  @IsEnum(TradeSource)
  source?: TradeSource;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  hasReason?: boolean;

  @ApiPropertyOptional({ example: 'swing,momentum' })
  @IsOptional()
  @IsString()
  tags?: string;
}
