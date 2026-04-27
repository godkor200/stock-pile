import { Emotion, TradeSide, TradeSource } from '../enums';
import { PaginationQuery } from '../common';

export interface CreateTradeDto {
  ticker: string;
  side: TradeSide;
  quantity: number;
  price: number;
  tradedAt: Date;
  reason?: string;
  emotion?: Emotion;
  tags?: string[];
  source: TradeSource;
}

export interface UpdateTradeDto {
  reason?: string;
  emotion?: Emotion;
  tags?: string[];
  quantity?: number;
  price?: number;
}

export interface BulkUpdateTradeDto {
  tradeIds: string[];
  patch: UpdateTradeDto;
}

export interface TradeResponseDto {
  id: string;
  userId: string;
  ticker: string;
  side: TradeSide;
  quantity: number;
  price: number;
  tradedAt: Date;
  reason: string | null;
  emotion: Emotion | null;
  tags: string[];
  source: TradeSource;
  createdAt: Date;
}

export interface TradeFilterQuery extends PaginationQuery {
  ticker?: string;
  side?: TradeSide;
  emotion?: Emotion;
  source?: TradeSource;
  from?: string;
  to?: string;
  hasReason?: boolean;
  tags?: string;
}
