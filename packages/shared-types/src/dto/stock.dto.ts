import { Market } from '../enums';

export interface StockResponseDto {
  ticker: string;
  name: string;
  market: Market;
  sector: string | null;
  updatedAt: Date;
}

export interface StockSearchResultDto {
  ticker: string;
  name: string;
  market: Market;
  currentPrice: number | null;
  changeRate: number | null;
}
