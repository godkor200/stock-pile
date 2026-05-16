import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PositionsService } from '../positions/positions.service';
import { TradesService } from '../trades/trades.service';
import { StocksService } from '../stocks/stocks.service';
import { ReportClientService } from './report-client.service';
import { CLASSIFY_INTENT_SYSTEM } from './prompts/classify-intent.prompt';
import { buildAdvisorSystemPrompt } from './prompts/investment-advisor.prompt';
import { ChatHistoryItem } from './dto/chat-message.dto';

export type ChatIntent = 'TRADE_ENTRY' | 'INVESTMENT_QUERY';

@Injectable()
export class ChatAdvisorService {
  private readonly logger = new Logger(ChatAdvisorService.name);

  private readonly groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly groqModel: string;
  private readonly groqApiKey: string;
  private readonly anthropic: Anthropic;
  private readonly hasAnthropicKey: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly positionsService: PositionsService,
    private readonly tradesService: TradesService,
    private readonly stocksService: StocksService,
    private readonly reportClient: ReportClientService,
  ) {
    this.groqModel = config.get('GROQ_MODEL', 'llama-3.1-8b-instant');
    this.groqApiKey = config.get('GROQ_API_KEY', '');
    const anthropicKey = config.get<string>('ANTHROPIC_API_KEY', '');
    this.hasAnthropicKey = !!anthropicKey;
    this.anthropic = new Anthropic({ apiKey: anthropicKey });
  }

  /**
   * 사용자 메시지의 의도와 언급 종목 ticker/stockQuery를 분류한다.
   * history가 있으면 직전 대화 맥락을 포함해 분류 정확도를 높인다.
   */
  async classify(
    message: string,
    history?: ChatHistoryItem[],
  ): Promise<{ intent: ChatIntent; ticker: string | null; stockQuery: string | null }> {
    try {
      const contextPrefix =
        history && history.length > 0
          ? `[이전 대화]\n${history
              .slice(-4)
              .map((h) => `${h.role === 'user' ? '사용자' : '어시스턴트'}: ${h.content}`)
              .join('\n')}\n\n[현재 메시지]\n`
          : '';

      const text = await this.callGroq(CLASSIFY_INTENT_SYSTEM, `${contextPrefix}${message}`);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { intent: 'TRADE_ENTRY', ticker: null, stockQuery: null };

      const parsed = JSON.parse(match[0]) as {
        intent?: string;
        ticker?: string | null;
        stockQuery?: string | null;
      };
      return {
        intent: parsed.intent === 'INVESTMENT_QUERY' ? 'INVESTMENT_QUERY' : 'TRADE_ENTRY',
        ticker: parsed.ticker ?? null,
        stockQuery: parsed.stockQuery ?? null,
      };
    } catch (err) {
      this.logger.warn(`의도 분류 실패, TRADE_ENTRY로 폴백: ${(err as Error).message}`);
      return { intent: 'TRADE_ENTRY', ticker: null, stockQuery: null };
    }
  }

  /**
   * 포트폴리오 컨텍스트(현재가 포함)를 로드한 뒤 투자 질문에 답변한다.
   * ticker가 지정된 경우 포트폴리오 미보유 종목이라도 현재가를 직접 조회해 포함한다.
   */
  async advise(
    userId: string,
    question: string,
    ticker?: string | null,
    history?: ChatHistoryItem[],
  ): Promise<string> {
    const [positions, recentTrades, analysis, queriedPrice] = await Promise.all([
      this.positionsService.findAll(userId),
      this.tradesService.findRecent(userId, 10),
      ticker ? this.reportClient.fetchAnalysis(userId, ticker) : Promise.resolve(null),
      // 언급된 종목의 현재가를 포트폴리오 보유 여부와 무관하게 조회
      ticker ? this.stocksService.fetchCurrentPrice(ticker) : Promise.resolve(null),
    ]);

    // 보유 종목 현재가를 Yahoo Finance에서 병렬 조회
    const currentPrices = await Promise.all(
      positions.map((p) => this.stocksService.fetchCurrentPrice(p.ticker)),
    );

    // 조회 종목 이름 확인 (DB에 없으면 ticker 그대로)
    const queriedStockEntity = ticker ? await this.stocksService.findByTicker(ticker) : null;
    const queriedStock = ticker
      ? {
          ticker,
          name: queriedStockEntity?.name ?? ticker,
          currentPrice: queriedPrice,
        }
      : null;

    const systemPrompt = buildAdvisorSystemPrompt(
      {
        positions: positions.map((p, i) => ({
          ticker: p.ticker,
          stockName: (p as unknown as { stock?: { name: string } }).stock?.name ?? p.ticker,
          quantity: Number(p.quantity),
          avgPrice: Number(p.avgPrice),
          realizedPnl: Number(p.realizedPnl),
          currentPrice: currentPrices[i],
        })),
        recentTrades: recentTrades.map((t) => ({
          ticker: t.ticker,
          stockName: (t as unknown as { stock?: { name: string } }).stock?.name ?? t.ticker,
          side: t.side,
          quantity: Number(t.quantity),
          price: Number(t.price),
          tradedAt: t.tradedAt.toISOString(),
          reason: t.reason,
          emotion: t.emotion,
        })),
      },
      analysis,
      queriedStock,
    );

    try {
      if (this.hasAnthropicKey) {
        return await this.callAnthropic(systemPrompt, question, history);
      }
      return await this.callGroq(systemPrompt, question, history);
    } catch (err) {
      this.logger.error(`투자 조언 LLM 호출 실패: ${(err as Error).message}`);
      throw err;
    }
  }

  // ── Groq (OpenAI 호환) ──────────────────────────────────────

  private async callGroq(
    system: string,
    userMessage: string,
    history?: ChatHistoryItem[],
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const historyMessages = (history ?? []).slice(-6).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    const res = await fetch(this.groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.groqApiKey}`,
      },
      body: JSON.stringify({
        model: this.groqModel,
        temperature: 0.3,
        max_tokens: 512,
        messages: [
          { role: 'system', content: system },
          ...historyMessages,
          { role: 'user', content: userMessage },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Groq API error: ${res.status} ${res.statusText}`);

    const data = (await res.json()) as { choices?: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  }

  // ── Anthropic ───────────────────────────────────────────────

  private async callAnthropic(
    system: string,
    userMessage: string,
    history?: ChatHistoryItem[],
  ): Promise<string> {
    const historyMessages = (history ?? []).slice(-6).map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }));

    const res = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system,
      messages: [...historyMessages, { role: 'user', content: userMessage }],
    });

    this.logger.log(
      `Anthropic advisor: in=${res.usage.input_tokens} out=${res.usage.output_tokens}`,
    );

    return res.content.find((b) => b.type === 'text')?.text ?? '';
  }
}
