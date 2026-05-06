import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisReportEntity, StockEntity } from '@stock-pile/db-schema';
import { Market, Verdict } from '@stock-pile/shared-types';
import { DartService } from '../dart/dart.service';
import { NewsService } from '../news/news.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { LlmService } from '../llm/llm.service';
import { VectorStoreService } from '../vector/vector-store.service';
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

  constructor(
    @InjectRepository(AnalysisReportEntity)
    private readonly reportRepo: Repository<AnalysisReportEntity>,
    @InjectRepository(StockEntity)
    private readonly stockRepo: Repository<StockEntity>,
    private readonly dart: DartService,
    private readonly news: NewsService,
    private readonly indicators: IndicatorsService,
    private readonly llm: LlmService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  /**
   * 종목 분석 리포트 생성 (24h DB 캐시)
   * 1. DB 캐시 확인
   * 2. DART + 뉴스 + 기술지표 수집 (parallel)
   * 3. 뉴스 임베딩 저장 (background)
   * 4. RAG: 관련 문서 벡터 검색
   * 5. LLM 합성
   * 6. DB 저장
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

    // 뉴스 임베딩 저장 (결과 기다리지 않음)
    this.embedNewsInBackground(ticker, newsItems);

    // RAG: 벡터 DB에서 관련 문서 검색
    const ragDocs = await this.vectorStore.search(
      `${ticker} 투자 분석 재무 성과`,
      ticker,
      5,
    );

    const newsForPrompt = newsItems.slice(0, 8).map((n) => ({
      title: n.title,
      date: n.pubDate,
    }));

    const prompt = buildAnalysisPrompt({
      ticker,
      financial: { statements: financial?.list ?? [], disclosures: disclosures?.list ?? [] },
      news: newsForPrompt,
      indicators: indicatorSummary,
      ragContext: ragDocs.map((d) => d.content).join('\n\n---\n\n'),
    });

    const llmRes = await this.llm.chat(STOCK_ANALYSIS_SYSTEM, [
      { role: 'user', content: prompt },
    ]);

    const jsonMatch = llmRes.text.match(/\{[\s\S]*\}/);
    const analysis: ClaudeAnalysisResult = jsonMatch
      ? (JSON.parse(jsonMatch[0]) as ClaudeAnalysisResult)
      : {
          summary: llmRes.text,
          strengths: [],
          weaknesses: [],
          riskFactors: [],
          verdict: Verdict.NEUTRAL,
          rationale: '',
        };

    // stocks FK 보장: 없거나 이름이 ticker와 같으면 Yahoo Finance에서 실제 이름 조회
    const existing = await this.stockRepo.findOne({ where: { ticker } });
    const needsName = !existing || existing.name === ticker;
    const stockName = needsName
      ? ((await this.indicators.fetchStockName(ticker)) ?? ticker)
      : existing.name;
    await this.stockRepo.upsert(
      { ticker, name: stockName, market: Market.KOSPI, sector: null },
      { conflictPaths: ['ticker'], skipUpdateIfNoValuesChanged: false },
    );

    const report = this.reportRepo.create({
      userId,
      ticker,
      financialSummary: { statements: financial?.list ?? [], disclosures: disclosures?.list ?? [] },
      newsSummary: { items: newsForPrompt },
      technicalIndicators: (indicatorSummary as unknown as Record<string, unknown>) ?? {},
      claudeAnalysis: JSON.stringify(analysis),
      verdict: analysis.verdict ?? Verdict.NEUTRAL,
    });

    const saved = await this.reportRepo.save(report);
    return this.reportRepo.findOne({ where: { id: saved.id }, relations: ['stock'] }) ?? saved;
  }

  async findByUser(userId: string, ticker?: string): Promise<AnalysisReportEntity[]> {
    const where = ticker ? { userId, ticker } : { userId };
    return this.reportRepo.find({
      where,
      relations: ['stock'],
      order: { generatedAt: 'DESC' },
      take: 20,
    });
  }

  private async findCached(userId: string, ticker: string): Promise<AnalysisReportEntity | null> {
    const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
    return this.reportRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId AND r.ticker = :ticker AND r.generatedAt > :cutoff', {
        userId,
        ticker,
        cutoff,
      })
      .orderBy('r.generatedAt', 'DESC')
      .getOne();
  }

  private embedNewsInBackground(ticker: string, newsItems: { title: string; description: string; pubDate: string }[]): void {
    Promise.allSettled(
      newsItems.slice(0, 20).map((n) =>
        this.vectorStore.upsert({
          ticker,
          content: `${n.title}\n${n.description ?? ''}`.trim(),
          source: 'NEWS',
          title: n.title,
          publishedAt: new Date(n.pubDate),
        }),
      ),
    ).then(() => {
      this.logger.log(`Embedded ${newsItems.length} news items for ${ticker}`);
    }).catch(() => {
      // 임베딩 실패는 리포트 생성에 영향 없음
    });
  }
}
