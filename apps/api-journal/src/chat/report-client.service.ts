import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StockAnalysisSummary {
  ticker: string;
  verdict: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  riskFactors: string[];
  rationale: string;
}

@Injectable()
export class ReportClientService {
  private readonly logger = new Logger(ReportClientService.name);
  private readonly reportUrl: string;

  constructor(private readonly config: ConfigService) {
    this.reportUrl = this.config.get('REPORT_URL', 'http://localhost:3002');
  }

  /**
   * api-report에서 종목 분석 리포트를 가져온다 (없으면 생성).
   * 실패 시 null 반환 — 어드바이저 답변에 영향 주지 않음.
   */
  async fetchAnalysis(userId: string, ticker: string): Promise<StockAnalysisSummary | null> {
    try {
      const res = await fetch(`${this.reportUrl}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ ticker }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        this.logger.warn(`리포트 조회 실패: ${res.status} ticker=${ticker}`);
        return null;
      }

      const report = (await res.json()) as {
        ticker: string;
        verdict: string;
        claudeAnalysis: string;
      };

      const parsed = this.parseAnalysis(report.claudeAnalysis);
      if (!parsed) return null;

      return { ticker: report.ticker, verdict: report.verdict, ...parsed };
    } catch (err) {
      this.logger.warn(`리포트 클라이언트 오류: ${(err as Error).message}`);
      return null;
    }
  }

  private parseAnalysis(raw: string): Omit<StockAnalysisSummary, 'ticker' | 'verdict'> | null {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]) as {
        summary?: string;
        strengths?: string[];
        weaknesses?: string[];
        riskFactors?: string[];
        rationale?: string;
      };
      return {
        summary: parsed.summary ?? '',
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
        riskFactors: parsed.riskFactors ?? [],
        rationale: parsed.rationale ?? '',
      };
    } catch {
      return null;
    }
  }
}
