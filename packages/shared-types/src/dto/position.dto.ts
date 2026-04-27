export interface PositionResponseDto {
  userId: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  realizedPnl: number;
  updatedAt: Date;
}
