import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { PositionEntity } from '@stock-pile/db-schema';
import { TradeSide } from '@stock-pile/shared-types';
import { InsufficientQuantityError } from '../trades/errors/insufficient-quantity.error';

export interface ApplyTradeParams {
  userId: string;
  ticker: string;
  side: TradeSide;
  quantity: number;
  price: number;
}

@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(PositionEntity)
    private readonly positionRepo: Repository<PositionEntity>,
  ) {}

  /** 사용자 보유 포지션 전체 조회 (종목명 포함) */
  async findAll(userId: string): Promise<PositionEntity[]> {
    return this.positionRepo.find({
      where: { userId },
      relations: ['stock'],
      order: { ticker: 'ASC' },
    });
  }

  async applyTrade(
    params: ApplyTradeParams,
    em: EntityManager,
  ): Promise<PositionEntity> {
    const { userId, ticker, side, quantity, price } = params;
    const repo = em.getRepository(PositionEntity);

    let position = await repo.findOne({ where: { userId, ticker } });

    if (side === TradeSide.BUY) {
      if (!position) {
        position = repo.create({
          userId,
          ticker,
          quantity,
          avgPrice: price,
          realizedPnl: 0,
        });
      } else {
        const existingQty = Number(position.quantity);
        const existingAvg = Number(position.avgPrice);
        const newTotalQty = existingQty + quantity;
        position.avgPrice =
          (existingQty * existingAvg + quantity * price) / newTotalQty;
        position.quantity = newTotalQty;
      }
    } else {
      // SELL
      if (!position || Number(position.quantity) < quantity) {
        const available = position ? Number(position.quantity) : 0;
        throw new InsufficientQuantityError(ticker, available, quantity);
      }
      const avgPrice = Number(position.avgPrice);
      position.realizedPnl =
        Number(position.realizedPnl) + (price - avgPrice) * quantity;
      position.quantity = Number(position.quantity) - quantity;
    }

    return repo.save(position);
  }
}
