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
  status: 'READY_TO_CONFIRM' | 'AMBIGUOUS_STOCK' | 'NEEDS_CLARIFICATION' | 'STOCK_NOT_FOUND' | 'CHAT_RESPONSE';
  /** 매매 파싱 결과 — CHAT_RESPONSE 시 없음 */
  parsed?: ParsedTradeFromChat;
  /** 세션 ID — CHAT_RESPONSE 시 없음 */
  sessionId?: string;
  candidates?: StockCandidateDto[];
  prompt?: string;
  /** CHAT_RESPONSE 시 어드바이저 답변 */
  message?: string;
  /** CHAT_RESPONSE 시 언급된 종목 ticker (있을 때만) */
  advisedTicker?: string;
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
