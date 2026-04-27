import { Verdict } from '../enums';

export interface CreateReportRequestDto {
  ticker: string;
}

export interface AnalysisReportResponseDto {
  id: string;
  userId: string;
  ticker: string;
  generatedAt: Date;
  financialSummary: Record<string, unknown>;
  newsSummary: Record<string, unknown>;
  technicalIndicators: Record<string, unknown>;
  claudeAnalysis: string;
  verdict: Verdict;
}

export interface ReportSummaryDto {
  strengths: string[];
  weaknesses: string[];
  riskFactors: string[];
  verdict: Verdict;
  rationale: string;
}
