import { BadRequestException } from '@nestjs/common';

export class InsufficientQuantityError extends BadRequestException {
  constructor(ticker: string, available: number, requested: number) {
    super(
      `SELL 수량(${requested})이 보유 수량(${available})을 초과합니다. [ticker: ${ticker}]`,
    );
  }
}
