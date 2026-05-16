import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ParsedTradeFromChat } from '@stock-pile/shared-types';

export class ChatHistoryItem {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ChatMessageDto {
  @ApiProperty({ example: '삼성전자 10주 70000원에 매수했어' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: '직전 대화 이력 (최대 6턴). 맥락 유지를 위해 프론트엔드에서 전달.',
    type: [ChatHistoryItem],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItem)
  history?: ChatHistoryItem[];
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
