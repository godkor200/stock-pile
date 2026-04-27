import { Emotion, TradeSource } from '../enums';

export interface AnalyticsSummaryDto {
  totalTrades: number;
  winRate: number;
  totalRealizedPnl: number;
  avgHoldingDays: number;
  activePositions: number;
}

export interface MonthlyReturnDto {
  year: number;
  month: number;
  returnRate: number;
  tradeCount: number;
}

export interface TickerPnlDto {
  ticker: string;
  stockName: string;
  realizedPnl: number;
  tradeCount: number;
  winRate: number;
}

export interface EmotionStatsDto {
  emotion: Emotion;
  tradeCount: number;
  winRate: number;
  avgReturn: number;
}

export interface SourceStatsDto {
  source: TradeSource;
  tradeCount: number;
  winRate: number;
  avgReturn: number;
}
