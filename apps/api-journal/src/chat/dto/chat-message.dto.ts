import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ParsedTradeFromChat } from '@stock-pile/shared-types';

export class ChatMessageDto {
  @ApiProperty({ example: '삼성전자 10주 70000원에 매수했어' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ClarifyDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiPropertyOptional({ example: '005930' })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiPropertyOptional()
  @IsOptional()
  fieldUpdates?: Partial<ParsedTradeFromChat>;
}

export class ConfirmDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;
}
