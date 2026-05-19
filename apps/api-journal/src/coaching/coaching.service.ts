import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TradeEntity } from '@stock-pile/db-schema';
import Anthropic from '@anthropic-ai/sdk';
import {
  COACHING_SYSTEM,
  buildCoachingPrompt,
  CoachingStats,
} from './prompts/coaching.prompt';

export interface CoachingResult {
  summary: string;
  strengths: string[];
  improvements: string[];
  nextMonthTips: string[];
}

export interface MonthlyCoachingResponse {
  year: number;
  month: number;
  stats: CoachingStats;
  coaching: CoachingResult;
}

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);
  private readonly groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly groqModel: string;
  private readonly groqApiKey: string;
  private readonly anthropic: Anthropic;
  private readonly hasAnthropicKey: boolean;

  constructor(
    @InjectRepository(TradeEntity)
    private readonly tradeRepo: Repository<TradeEntity>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    this.groqModel = config.get('GROQ_MODEL', 'llama-3.1-8b-instant');
    this.groqApiKey = config.get('GROQ_API_KEY', '');
    const anthropicKey = config.get<string>('ANTHROPIC_API_KEY', '');
    this.hasAnthropicKey = !!anthropicKey;
    this.anthropic = new Anthropic({ apiKey: anthropicKey });
  }

  /**
   * 월간 코칭 리포트 생성
   * 해당 월 매매 통계를 집계한 뒤 LLM으로 코칭 분석을 반환한다.
   */
  async getMonthlyCoaching(
    userId: string,
    year: number,
    month: number,
  ): Promise<MonthlyCoachingResponse> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);

    const trades = await this.tradeRepo
      .createQueryBuilder('trade')
      .leftJoinAndSelect('trade.stock', 'stock')
      .where('trade.user_id = :userId', { userId })
      .andWhere('trade.traded_at >= :from', { from })
      .andWhere('trade.traded_at <= :to', { to })
      .orderBy('trade.traded_at', 'DESC')
      .getMany();

    const stats = this.aggregateStats(trades, year, month);

    if (stats.totalTrades === 0) {
      return {
        year,
        month,
        stats,
        coaching: {
          summary: '이달 매매 기록이 없습니다.',
          strengths: [],
          improvements: ['매매 일지를 꾸준히 기록해보세요.'],
          nextMonthTips: ['작은 금액으로 시작해 매매 습관을 만들어보세요.'],
        },
      };
    }

    const pnlResult = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(p.realized_pnl), 0)', 'total')
      .from('positions', 'p')
      .where('p.user_id = :userId', { userId })
      .getRawOne<{ total: string }>();

    stats.totalRealizedPnl = parseFloat(pnlResult?.total ?? '0');

    const prompt = buildCoachingPrompt(stats);
    const coaching = await this.callLlm(prompt);

    return { year, month, stats, coaching };
  }

  private aggregateStats(
    trades: TradeEntity[],
    year: number,
    month: number,
  ): CoachingStats {
    const buyCount = trades.filter((t) => t.side === 'BUY').length;
    const sellCount = trades.filter((t) => t.side === 'SELL').length;

    // 종목별 거래 횟수
    const tickerCount = new Map<string, { name: string; count: number }>();
    for (const t of trades) {
      const prev = tickerCount.get(t.ticker) ?? { name: t.stock?.name ?? t.ticker, count: 0 };
      tickerCount.set(t.ticker, { ...prev, count: prev.count + 1 });
    }
    const topTickers = [...tickerCount.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([ticker, v]) => ({ ticker, name: v.name, count: v.count }));

    // 감정 분포
    const emotionDistribution: Record<string, number> = {};
    for (const t of trades) {
      if (t.emotion) {
        emotionDistribution[t.emotion] = (emotionDistribution[t.emotion] ?? 0) + 1;
      }
    }

    // reason 기록 비율
    const withReason = trades.filter((t) => !!t.reason).length;
    const reasonRate = trades.length > 0 ? withReason / trades.length : 0;

    return {
      year,
      month,
      totalTrades: trades.length,
      buyCount,
      sellCount,
      topTickers,
      emotionDistribution,
      reasonRate,
      totalRealizedPnl: 0,
    };
  }

  private async callLlm(prompt: string): Promise<CoachingResult> {
    const fallback: CoachingResult = {
      summary: '분석 중 오류가 발생했습니다.',
      strengths: [],
      improvements: [],
      nextMonthTips: [],
    };

    try {
      let raw: string;
      if (this.hasAnthropicKey) {
        raw = await this.callAnthropic(prompt);
      } else {
        raw = await this.callGroq(prompt);
      }
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return fallback;
      return JSON.parse(match[0]) as CoachingResult;
    } catch (err) {
      this.logger.error(`coaching LLM 실패: ${err}`);
      return fallback;
    }
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const res = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: COACHING_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = res.content[0];
    return block.type === 'text' ? block.text : '';
  }

  private async callGroq(prompt: string): Promise<string> {
    const res = await fetch(this.groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.groqApiKey}`,
      },
      body: JSON.stringify({
        model: this.groqModel,
        messages: [
          { role: 'system', content: COACHING_SYSTEM },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Groq error: ${res.statusText}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
  }
}
