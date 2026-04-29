import { ChatSessionStatus, Emotion, TradeSide } from '../enums';

export interface ParseTradeFromChatDto {
  message: string;
}

export interface ParsedTradeFromChat {
  side: TradeSide | null;
  stockQuery: string;
  ticker?: string;
  quantity?: number;
  quantityUnit: 'SHARES' | 'AMOUNT';
  price?: number;
  useMarketPrice: boolean;
  reason?: string;
  emotion?: Emotion;
  confidence: number;
  missingFields: string[];
  clarificationQuestion?: string;
}

export interface ChatParseResponseDto {
  status: 'READY_TO_CONFIRM' | 'AMBIGUOUS_STOCK' | 'NEEDS_CLARIFICATION' | 'STOCK_NOT_FOUND';
  parsed: ParsedTradeFromChat;
  sessionId: string;
  candidates?: StockCandidateDto[];
  prompt?: string;
}

export interface StockCandidateDto {
  ticker: string;
  name: string;
}

export interface ClarifyTradeDto {
  sessionId: string;
  ticker?: string;
  fieldUpdates?: Partial<ParsedTradeFromChat>;
}

export interface ConfirmTradeDto {
  sessionId: string;
}

export interface ChatSessionResponseDto {
  sessionId: string;
  userId: string;
  parsedData: ParsedTradeFromChat;
  missingFields: string[];
  status: ChatSessionStatus;
  expiresAt: Date;
}
