export interface ParseStrategyRequestDto {
  naturalLanguage: string;
}

export interface StrategyDsl {
  name: string;
  entry: {
    conditions: DslCondition[];
    logic?: 'AND' | 'OR';
  };
  exit: {
    conditions: DslCondition[];
    logic?: 'AND' | 'OR';
  };
  positionSizing: {
    type: 'fixed_amount' | 'fixed_shares' | 'percent_capital';
    value: number;
  };
}

export interface DslCondition {
  type:
    | 'indicator_crossover'
    | 'indicator_threshold'
    | 'price_above'
    | 'price_below'
    | 'volume_spike'
    | 'profit_target'
    | 'stop_loss';
  indicator?: 'MA' | 'RSI' | 'MACD' | 'Bollinger';
  periodShort?: number;
  periodLong?: number;
  period?: number;
  direction?: 'above' | 'below';
  value?: number;
}

export interface StrategyResponseDto {
  id: string;
  userId: string;
  name: string;
  naturalLanguage: string;
  parsedDsl: StrategyDsl;
  createdAt: Date;
}

export interface RunBacktestRequestDto {
  strategyId: string;
  ticker: string;
  periodStart: string;
  periodEnd: string;
  initialCapital: number;
}

export interface BacktestResultResponseDto {
  id: string;
  strategyId: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  sharpeRatio: number;
  totalTrades: number;
  tradesLog: Record<string, unknown>;
  createdAt: Date;
}
