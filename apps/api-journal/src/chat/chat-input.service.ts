import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ParsedTradeFromChat } from '@stock-pile/shared-types';
import { PARSE_TRADE_SYSTEM, parseTradeTool } from './prompts/parse-trade.prompt';

@Injectable()
export class ChatInputService {
  private readonly logger = new Logger(ChatInputService.name);
  private readonly client: Anthropic;

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  /**
   * Claude Tool Use로 자연어 메시지를 매매 정보로 파싱
   */
  async parse(message: string): Promise<ParsedTradeFromChat> {
    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: PARSE_TRADE_SYSTEM,
      tools: [parseTradeTool],
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: message }],
    });

    this.logger.log(
      `Claude usage: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`,
    );

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude가 tool_use 블록을 반환하지 않았습니다');
    }

    const input = toolUse.input as Record<string, unknown>;

    return {
      side: (input.side as ParsedTradeFromChat['side']) ?? null,
      stockQuery: (input.stockQuery as string) ?? '',
      ticker: (input.ticker as string) ?? undefined,
      quantity: (input.quantity as number) ?? undefined,
      quantityUnit: ((input.quantityUnit as string) ?? 'SHARES') as 'SHARES' | 'AMOUNT',
      price: (input.price as number) ?? undefined,
      useMarketPrice: Boolean(input.useMarketPrice ?? true),
      reason: (input.reason as string) ?? undefined,
      emotion: (input.emotion as ParsedTradeFromChat['emotion']) ?? undefined,
      confidence: (input.confidence as number) ?? 0,
      missingFields: (input.missingFields as string[]) ?? [],
      clarificationQuestion: (input.clarificationQuestion as string) ?? undefined,
    };
  }
}
