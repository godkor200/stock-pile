import {
  IsString,
  IsEnum,
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Emotion, TradeSide, TradeSource } from '@stock-pile/shared-types';

export class CreateTradeDto {
  @ApiProperty({ example: 'SAMSUNG' })
  @IsString()
  ticker: string;

  @ApiProperty({ enum: TradeSide })
  @IsEnum(TradeSide)
  side: TradeSide;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 70000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiProperty({ example: '2026-04-27T09:00:00.000Z' })
  @IsDateString()
  tradedAt: string;

  @ApiPropertyOptional({ example: '기술적 돌파 매수' })
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

  @ApiProperty({ enum: TradeSource })
  @IsEnum(TradeSource)
  source: TradeSource;
}
