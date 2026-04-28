import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AnalysisReportEntity } from '@stock-pile/db-schema';
import { Verdict } from '@stock-pile/shared-types';
import { DartService } from '../dart/dart.service';
import { NewsService } from '../news/news.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { STOCK_ANALYSIS_SYSTEM, buildAnalysisPrompt } from './prompts/stock-analysis.prompt';

const CACHE_TTL_HOURS = 24;

interface ClaudeAnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  riskFactors: string[];
  verdict: Verdict;
  rationale: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly claude: Anthropic;

  constructor(
    @InjectRepository(AnalysisReportEntity)
    private readonly reportRepo: Repository<AnalysisReportEntity>,
    private readonly dart: DartService,
    private readonly news: NewsService,
    private readonly indicators: IndicatorsService,
    private readonly config: ConfigService,
  ) {
    this.claude = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  /**
   * 종목 분석 리포트 생성 (24h DB 캐시)
   */
  async generate(userId: string, ticker: string): Promise<AnalysisReportEntity> {
    const cached = await this.findCached(userId, ticker);
    if (cached) return cached;

    const year = new Date().getFullYear();

    const [financial, disclosures, newsItems, indicatorSummary] = await Promise.all([
      this.dart.getFinancialStatements(ticker, year),
      this.dart.getRecentDisclosures(ticker, 30),
      this.news.searchNews(ticker, 14),
      this.indicators.getIndicatorSummary(ticker),
    ]);

    const newsForPrompt = newsItems.slice(0, 10).map((n) => ({
      title: n.title,
      date: n.pubDate,
    }));

    const prompt = buildAnalysisPrompt({
      ticker,
      financial: { statements: financial?.list ?? [], disclosures: disclosures?.list ?? [] },
      news: newsForPrompt,
      indicators: indicatorSummary,
    });

    const response = await this.claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: STOCK_ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    this.logger.log(
      `Claude usage: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`,
    );

    const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const analysis: ClaudeAnalysisResult = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { summary: text, strengths: [], weaknesses: [], riskFactors: [], verdict: Verdict.NEUTRAL, rationale: '' };

    const report = this.reportRepo.create({
      userId,
      ticker,
      financialSummary: { statements: financial?.list ?? [], disclosures: disclosures?.list ?? [] },
      newsSummary: { items: newsForPrompt },
      technicalIndicators: (indicatorSummary as unknown as Record<string, unknown>) ?? {},
      claudeAnalysis: JSON.stringify(analysis),
      verdict: analysis.verdict ?? Verdict.NEUTRAL,
    });

    return this.reportRepo.save(report);
  }

  async findByUser(userId: string, ticker?: string): Promise<AnalysisReportEntity[]> {
    const where = ticker ? { userId, ticker } : { userId };
    return this.reportRepo.find({
      where,
      order: { generatedAt: 'DESC' },
      take: 20,
    });
  }

  private async findCached(userId: string, ticker: string): Promise<AnalysisReportEntity | null> {
    const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
    const report = await this.reportRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId AND r.ticker = :ticker AND r.generatedAt > :cutoff', {
        userId,
        ticker,
        cutoff,
      })
      .orderBy('r.generatedAt', 'DESC')
      .getOne();
    return report;
  }
}
