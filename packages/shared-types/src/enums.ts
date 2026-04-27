export enum TradeSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum Emotion {
  PLANNED = 'PLANNED',
  IMPULSIVE = 'IMPULSIVE',
  NEWS_REACTION = 'NEWS_REACTION',
  TECHNICAL = 'TECHNICAL',
  FOMO = 'FOMO',
}

export enum TradeSource {
  CHATBOT = 'CHATBOT',
  CSV_IMPORT = 'CSV_IMPORT',
  MANUAL_EDIT = 'MANUAL_EDIT',
}

export enum Verdict {
  BUY = 'BUY',
  HOLD = 'HOLD',
  SELL = 'SELL',
  NEUTRAL = 'NEUTRAL',
}

export enum Market {
  KOSPI = 'KOSPI',
  KOSDAQ = 'KOSDAQ',
  NASDAQ = 'NASDAQ',
  NYSE = 'NYSE',
}

export enum ChatSessionStatus {
  PENDING = 'PENDING',
  AMBIGUOUS = 'AMBIGUOUS',
  READY = 'READY',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
}

export enum BacktestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}
