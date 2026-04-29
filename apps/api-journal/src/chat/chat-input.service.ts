import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ParsedTradeFromChat } from '@stock-pile/shared-types';
import { PARSE_TRADE_SYSTEM } from './prompts/parse-trade.prompt';

type Provider = 'groq' | 'ollama' | 'anthropic';

interface RawParsed {
  side?: string | null;
  stockQuery?: string;
  ticker?: string;
  quantity?: number | null;
  quantityUnit?: string;
  price?: number | null;
  useMarketPrice?: boolean;
  reason?: string | null;
  emotion?: string | null;
  confidence?: number;
  missingFields?: string[];
  clarificationQuestion?: string | null;
}

@Injectable()
export class ChatInputService {
  private readonly logger = new Logger(ChatInputService.name);
  private readonly provider: Provider;

  // Groq / Ollama 공통 (OpenAI 호환)
  private readonly chatUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  // Anthropic fallback
  private readonly anthropic: Anthropic;

  constructor(private readonly config: ConfigService) {
    this.provider = (config.get('LLM_PROVIDER', 'groq') as Provider);

    this.chatUrl =
      this.provider === 'ollama'
        ? `${config.get('OLLAMA_URL', 'http://localhost:11434')}/api/chat`
        : 'https://api.groq.com/openai/v1/chat/completions';

    this.model =
      this.provider === 'ollama'
        ? config.get('OLLAMA_MODEL', 'qwen2.5:7b')
        : config.get('GROQ_MODEL', 'llama-3.1-8b-instant');

    this.apiKey = config.get('GROQ_API_KEY', '');

    this.anthropic = new Anthropic({
      apiKey: config.get<string>('ANTHROPIC_API_KEY', ''),
    });

    this.logger.log(`Chat LLM provider: ${this.provider} / model: ${this.model}`);
  }

  /** 자연어 메시지 → 매매 정보 구조화 */
  async parse(message: string): Promise<ParsedTradeFromChat> {
    if (this.provider === 'anthropic') {
      return this.parseWithAnthropic(message);
    }
    return this.parseWithOpenAiCompat(message);
  }

  // ── Groq / Ollama (OpenAI 호환) ────────────────────────────

  private async parseWithOpenAiCompat(message: string): Promise<ParsedTradeFromChat> {
    const isOllama = this.provider === 'ollama';

    const body = isOllama
      ? {
          model: this.model,
          stream: false,
          options: { num_predict: 512 },
          messages: [
            { role: 'system', content: PARSE_TRADE_SYSTEM },
            { role: 'user', content: message },
          ],
        }
      : {
          model: this.model,
          temperature: 0.1,
          max_tokens: 512,
          messages: [
            { role: 'system', content: PARSE_TRADE_SYSTEM },
            { role: 'user', content: message },
          ],
        };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!isOllama && this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(this.chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`LLM API error: ${res.status} ${res.statusText}`);

    const data = (await res.json()) as {
      // Groq / OpenAI 형식
      choices?: { message: { content: string } }[];
      // Ollama 형식
      message?: { content: string };
    };

    const text = data.choices?.[0]?.message?.content ?? data.message?.content ?? '';
    this.logger.log(`${this.provider} raw: ${text.slice(0, 120)}`);

    return this.extractParsed(text);
  }

  // ── Anthropic (Tool Use) ────────────────────────────────────

  private async parseWithAnthropic(message: string): Promise<ParsedTradeFromChat> {
    const res = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: PARSE_TRADE_SYSTEM,
      messages: [{ role: 'user', content: message }],
    });

    this.logger.log(
      `Anthropic usage: in=${res.usage.input_tokens} out=${res.usage.output_tokens}`,
    );

    const text = res.content.find((b) => b.type === 'text')?.text ?? '';
    return this.extractParsed(text);
  }

  // ── 공통 JSON 추출 ──────────────────────────────────────────

  private extractParsed(text: string): ParsedTradeFromChat {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.logger.warn(`JSON 추출 실패, 원문: ${text}`);
      return this.emptyParsed();
    }

    try {
      const raw = JSON.parse(jsonMatch[0]) as RawParsed;
      return {
        side: (raw.side as ParsedTradeFromChat['side']) ?? null,
        stockQuery: raw.stockQuery ?? '',
        ticker: raw.ticker ?? undefined,
        quantity: raw.quantity ?? undefined,
        quantityUnit: (raw.quantityUnit as 'SHARES' | 'AMOUNT') ?? 'SHARES',
        price: raw.price ?? undefined,
        useMarketPrice: raw.useMarketPrice ?? true,
        reason: raw.reason ?? undefined,
        emotion: (raw.emotion as ParsedTradeFromChat['emotion']) ?? undefined,
        confidence: raw.confidence ?? 0,
        missingFields: raw.missingFields ?? [],
        clarificationQuestion: raw.clarificationQuestion ?? undefined,
      };
    } catch {
      this.logger.warn(`JSON 파싱 실패: ${jsonMatch[0].slice(0, 80)}`);
      return this.emptyParsed();
    }
  }

  private emptyParsed(): ParsedTradeFromChat {
    return {
      side: null,
      stockQuery: '',
      quantityUnit: 'SHARES',
      useMarketPrice: true,
      confidence: 0,
      missingFields: ['side', 'stockQuery', 'quantity'],
      clarificationQuestion: '매수/매도 여부, 종목명, 수량을 알려주세요.',
    };
  }
}
