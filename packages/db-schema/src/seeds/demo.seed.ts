import 'reflect-metadata';
import * as crypto from 'crypto';
import { AppDataSource } from '../data-source';
import { UserEntity } from '../entities/user.entity';
import { TradeEntity } from '../entities/trade.entity';
import { PositionEntity } from '../entities/position.entity';
import { Emotion, TradeSide, TradeSource } from '@stock-pile/shared-types';

const DEMO_EMAIL = 'test@gmail.com';
const DEMO_PASSWORD = 'Test1234!';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function d(dateStr: string): Date {
  return new Date(dateStr);
}

const TRADES: Omit<TradeEntity, 'id' | 'userId' | 'user' | 'stock' | 'createdAt'>[] = [
  // ── 삼성전자 (005930) ─────────────────────────────────────
  { ticker: '005930', side: TradeSide.BUY,  quantity: 50, price: 71000, tradedAt: d('2024-09-10'), reason: '반도체 사이클 저점 분할매수 1차', emotion: Emotion.PLANNED,   tags: ['반도체', '분할매수'], source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.BUY,  quantity: 50, price: 67500, tradedAt: d('2024-10-15'), reason: '추가 하락 시 2차 매수 계획대로 진행', emotion: Emotion.PLANNED,   tags: ['반도체', '분할매수'], source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.SELL, quantity: 30, price: 74200, tradedAt: d('2024-11-20'), reason: '1차 목표가 도달, 일부 익절', emotion: Emotion.PLANNED,   tags: ['익절'], source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.BUY,  quantity: 20, price: 69800, tradedAt: d('2025-01-08'), reason: '조정 구간 재매수', emotion: Emotion.TECHNICAL,  tags: ['반도체', '재매수'], source: TradeSource.CHATBOT },

  // ── SK하이닉스 (000660) ───────────────────────────────────
  { ticker: '000660', side: TradeSide.BUY,  quantity: 20, price: 168000, tradedAt: d('2024-08-20'), reason: 'HBM 수요 확대 전망, 중기 보유 목적', emotion: Emotion.PLANNED,   tags: ['HBM', 'AI반도체'], source: TradeSource.CHATBOT },
  { ticker: '000660', side: TradeSide.BUY,  quantity: 10, price: 155000, tradedAt: d('2024-09-30'), reason: '엔비디아 실적 발표 앞두고 추가 매수', emotion: Emotion.NEWS_REACTION, tags: ['HBM', 'AI반도체'], source: TradeSource.CHATBOT },
  { ticker: '000660', side: TradeSide.SELL, quantity: 15, price: 195000, tradedAt: d('2024-12-05'), reason: '목표가 20만원 근접, 절반 익절', emotion: Emotion.PLANNED,   tags: ['익절'], source: TradeSource.CHATBOT },
  { ticker: '000660', side: TradeSide.SELL, quantity: 15, price: 178000, tradedAt: d('2025-02-14'), reason: '고점 대비 10% 조정, 나머지 청산', emotion: Emotion.TECHNICAL,  tags: ['손절'], source: TradeSource.CHATBOT },

  // ── NAVER (035420) ────────────────────────────────────────
  { ticker: '035420', side: TradeSide.BUY,  quantity: 15, price: 195000, tradedAt: d('2024-07-22'), reason: 'AI 검색 전환 기대, 저평가 판단', emotion: Emotion.PLANNED,   tags: ['AI', '인터넷'], source: TradeSource.CSV_IMPORT },
  { ticker: '035420', side: TradeSide.BUY,  quantity: 10, price: 181000, tradedAt: d('2024-10-02'), reason: '라인야후 이슈 과매도 구간 매수', emotion: Emotion.IMPULSIVE,  tags: ['인터넷', '분할매수'], source: TradeSource.CHATBOT },
  { ticker: '035420', side: TradeSide.SELL, quantity: 25, price: 172000, tradedAt: d('2025-01-20'), reason: '실적 기대 미달, 손실 감수하고 정리', emotion: Emotion.PLANNED,   tags: ['손절'], source: TradeSource.CHATBOT },

  // ── LG에너지솔루션 (373220) ───────────────────────────────
  { ticker: '373220', side: TradeSide.BUY,  quantity: 5,  price: 372000, tradedAt: d('2024-11-11'), reason: '전기차 캐즘 완화 조짐, 장기 보유 목적', emotion: Emotion.PLANNED,   tags: ['배터리', '전기차'], source: TradeSource.CHATBOT },
  { ticker: '373220', side: TradeSide.BUY,  quantity: 3,  price: 348000, tradedAt: d('2025-01-15'), reason: '추가 하락 시 분할매수 2차', emotion: Emotion.PLANNED,   tags: ['배터리', '분할매수'], source: TradeSource.CHATBOT },

  // ── 카카오 (035720) ───────────────────────────────────────
  { ticker: '035720', side: TradeSide.BUY,  quantity: 40, price: 47500, tradedAt: d('2024-06-10'), reason: '카카오페이 분기 흑자전환 기대', emotion: Emotion.NEWS_REACTION, tags: ['핀테크', '인터넷'], source: TradeSource.CSV_IMPORT },
  { ticker: '035720', side: TradeSide.SELL, quantity: 40, price: 44200, tradedAt: d('2024-08-05'), reason: '플랫폼 규제 리스크 현실화, 손절', emotion: Emotion.PLANNED,   tags: ['손절', '리스크관리'], source: TradeSource.CHATBOT },

  // ── 현대차 (005380) ───────────────────────────────────────
  { ticker: '005380', side: TradeSide.BUY,  quantity: 10, price: 235000, tradedAt: d('2025-02-03'), reason: '미국 관세 우려 과매도, 밸류에이션 매력', emotion: Emotion.TECHNICAL,  tags: ['자동차', '가치투자'], source: TradeSource.CHATBOT },
  { ticker: '005380', side: TradeSide.BUY,  quantity: 5,  price: 228000, tradedAt: d('2025-03-10'), reason: '추가 분할매수', emotion: Emotion.PLANNED,   tags: ['자동차', '분할매수'], source: TradeSource.CHATBOT },
];

async function main() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(UserEntity);
  const tradeRepo = AppDataSource.getRepository(TradeEntity);
  const posRepo = AppDataSource.getRepository(PositionEntity);

  // 유저 생성 (이미 있으면 재사용)
  let user = await userRepo.findOne({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = userRepo.create({ email: DEMO_EMAIL, passwordHash: hashPassword(DEMO_PASSWORD), telegramUserId: null });
    user = await userRepo.save(user);
    console.log(`✅ 유저 생성: ${DEMO_EMAIL}`);
  } else {
    console.log(`ℹ️  유저 기존 사용: ${DEMO_EMAIL}`);
    // 기존 데이터 삭제 후 재시드
    await posRepo.delete({ userId: user.id });
    await tradeRepo.delete({ userId: user.id });
  }

  // 매매 내역 삽입
  const trades = TRADES.map((t) => tradeRepo.create({ ...t, userId: user!.id }));
  await tradeRepo.save(trades);
  console.log(`✅ 매매 내역 ${trades.length}건 삽입`);

  // 포지션 계산 및 삽입
  const posMap = new Map<string, { qty: number; cost: number; realizedPnl: number }>();
  for (const t of TRADES) {
    const cur = posMap.get(t.ticker) ?? { qty: 0, cost: 0, realizedPnl: 0 };
    if (t.side === TradeSide.BUY) {
      cur.cost = (cur.qty * cur.cost + t.quantity * t.price) / (cur.qty + t.quantity);
      cur.qty += t.quantity;
    } else {
      cur.realizedPnl += (t.price - cur.cost) * t.quantity;
      cur.qty -= t.quantity;
    }
    posMap.set(t.ticker, cur);
  }

  for (const [ticker, pos] of posMap) {
    if (pos.qty <= 0) continue;
    await posRepo.save(
      posRepo.create({
        userId: user.id,
        ticker,
        quantity: pos.qty,
        avgPrice: Math.round(pos.cost),
        realizedPnl: Math.round(pos.realizedPnl),
      }),
    );
  }
  console.log(`✅ 포지션 ${[...posMap.values()].filter((p) => p.qty > 0).length}건 삽입`);

  await AppDataSource.destroy();
  console.log('\n🎉 데모 시드 완료!');
  console.log(`   이메일: ${DEMO_EMAIL}`);
  console.log(`   비밀번호: ${DEMO_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
