import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { PositionEntity } from '@stock-pile/db-schema';
import { TradeSide } from '@stock-pile/shared-types';
import { InsufficientQuantityError } from '../trades/errors/insufficient-quantity.error';
import axios from 'axios';

export interface ApplyTradeParams {
  userId: string;
  ticker: string;
  side: TradeSide;
  quantity: number;
  price: number;
}

export interface PositionWithPnl extends PositionEntity {
  currentPrice: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
}

const YAHOO_BASE = 'https://query1.finance.yahoo.com';

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

  constructor(
    @InjectRepository(PositionEntity)
    private readonly positionRepo: Repository<PositionEntity>,
  ) {}

  /** Yahoo Finance에서 현재가 조회. 실패 시 null 반환 */
  private async fetchCurrentPrice(ticker: string): Promise<number | null> {
    const symbols = /^\d{6}$/.test(ticker)
      ? [`${ticker}.KS`, `${ticker}.KQ`]
      : [ticker];
    for (const symbol of symbols) {
      try {
        const { data } = await axios.get(
          `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}`,
          { params: { interval: '1d', range: '5d' }, timeout: 6000 },
        );
        const closes: (number | null)[] =
          data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
        const price = closes.filter(Boolean).slice(-1)[0];
        if (price) return price;
      } catch {
        // 다음 심볼 시도
      }
    }
    return null;
  }

  /** 사용자 보유 포지션 전체 조회 (미실현 손익 포함) */
  async findAll(userId: string): Promise<PositionWithPnl[]> {
    const positions = await this.positionRepo.find({
      where: { userId },
      relations: ['stock'],
      order: { ticker: 'ASC' },
    });

    return Promise.all(
      positions.map(async (p) => {
        const qty = Number(p.quantity);
        if (qty === 0) {
          return { ...p, currentPrice: null, unrealizedPnl: null, unrealizedPnlPct: null };
        }
        const currentPrice = await this.fetchCurrentPrice(p.ticker).catch(() => null);
        if (currentPrice === null) {
          return { ...p, currentPrice: null, unrealizedPnl: null, unrealizedPnlPct: null };
        }
        const avgPrice = Number(p.avgPrice);
        const unrealizedPnl = (currentPrice - avgPrice) * qty;
        const unrealizedPnlPct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : null;
        return { ...p, currentPrice, unrealizedPnl, unrealizedPnlPct };
      }),
    );
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
