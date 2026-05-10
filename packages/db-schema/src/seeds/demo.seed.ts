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

type TradeRow = Omit<TradeEntity, 'id' | 'userId' | 'user' | 'stock' | 'createdAt'>;

const TRADES: TradeRow[] = [
  // ── 삼성전자 (005930) ─────────────────────────────────────
  { ticker: '005930', side: TradeSide.BUY,  quantity: 50,  price:  71000, tradedAt: d('2024-01-08'), reason: '반도체 사이클 저점 분할매수 1차',            emotion: Emotion.PLANNED,       tags: ['반도체','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.BUY,  quantity: 30,  price:  68500, tradedAt: d('2024-02-14'), reason: '2차 분할매수 — 추가 하락 기대',               emotion: Emotion.PLANNED,       tags: ['반도체','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.SELL, quantity: 30,  price:  76200, tradedAt: d('2024-04-20'), reason: '1차 목표가 도달, 30주 익절',                  emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.BUY,  quantity: 20,  price:  69800, tradedAt: d('2024-06-11'), reason: '조정 구간 재매수',                            emotion: Emotion.TECHNICAL,     tags: ['반도체','재매수'],   source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.SELL, quantity: 40,  price:  78500, tradedAt: d('2024-08-05'), reason: '2차 목표가 도달, 추가 익절',                  emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.BUY,  quantity: 100, price:  60200, tradedAt: d('2024-10-22'), reason: '52주 신저가 근처, 공격적 매수',               emotion: Emotion.TECHNICAL,     tags: ['반도체','저점매수'], source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.SELL, quantity: 50,  price:  65000, tradedAt: d('2024-12-03'), reason: '반등 구간 일부 익절',                        emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.BUY,  quantity: 50,  price:  57300, tradedAt: d('2025-01-15'), reason: '추가 하락 시 분할매수',                      emotion: Emotion.PLANNED,       tags: ['반도체','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '005930', side: TradeSide.SELL, quantity: 100, price:  62000, tradedAt: d('2025-03-20'), reason: '반등 후 손실 최소화',                        emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },

  // ── SK하이닉스 (000660) ───────────────────────────────────
  { ticker: '000660', side: TradeSide.BUY,  quantity: 20,  price: 168000, tradedAt: d('2024-01-22'), reason: 'HBM 수요 확대 전망, 중기 보유 목적',          emotion: Emotion.PLANNED,       tags: ['HBM','AI반도체'],   source: TradeSource.CHATBOT },
  { ticker: '000660', side: TradeSide.BUY,  quantity: 10,  price: 155000, tradedAt: d('2024-03-18'), reason: '엔비디아 실적 발표 앞두고 추가 매수',          emotion: Emotion.NEWS_REACTION, tags: ['HBM','AI반도체'],   source: TradeSource.CHATBOT },
  { ticker: '000660', side: TradeSide.SELL, quantity: 15,  price: 195000, tradedAt: d('2024-06-12'), reason: '목표가 20만원 근접, 절반 익절',               emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '000660', side: TradeSide.BUY,  quantity: 5,   price: 182000, tradedAt: d('2024-08-09'), reason: 'AI 서버 수요 지속, 재매수',                  emotion: Emotion.PLANNED,       tags: ['HBM','재매수'],     source: TradeSource.CHATBOT },
  { ticker: '000660', side: TradeSide.SELL, quantity: 20,  price: 210000, tradedAt: d('2024-10-31'), reason: '고점 부근 전량 정리',                        emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '000660', side: TradeSide.BUY,  quantity: 15,  price: 175000, tradedAt: d('2025-01-08'), reason: '조정 후 재진입',                             emotion: Emotion.TECHNICAL,     tags: ['HBM','재매수'],     source: TradeSource.CHATBOT },
  { ticker: '000660', side: TradeSide.SELL, quantity: 15,  price: 190000, tradedAt: d('2025-03-05'), reason: '단기 반등 후 익절',                          emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── NAVER (035420) ────────────────────────────────────────
  { ticker: '035420', side: TradeSide.BUY,  quantity: 15,  price: 195000, tradedAt: d('2024-02-05'), reason: 'AI 검색 전환 기대, 저평가 판단',              emotion: Emotion.PLANNED,       tags: ['AI','인터넷'],      source: TradeSource.CSV_IMPORT },
  { ticker: '035420', side: TradeSide.BUY,  quantity: 10,  price: 181000, tradedAt: d('2024-04-25'), reason: '라인야후 이슈 과매도 구간 추가 매수',          emotion: Emotion.IMPULSIVE,     tags: ['인터넷','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '035420', side: TradeSide.SELL, quantity: 10,  price: 205000, tradedAt: d('2024-07-10'), reason: '쇼핑·광고 실적 호조 반영, 일부 익절',         emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '035420', side: TradeSide.SELL, quantity: 15,  price: 172000, tradedAt: d('2024-11-08'), reason: '실적 기대 미달, 손실 감수하고 정리',           emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },
  { ticker: '035420', side: TradeSide.BUY,  quantity: 8,   price: 160000, tradedAt: d('2025-02-12'), reason: '과매도 구간 저점 매수',                      emotion: Emotion.TECHNICAL,     tags: ['인터넷','저점매수'], source: TradeSource.CHATBOT },

  // ── 카카오 (035720) ───────────────────────────────────────
  { ticker: '035720', side: TradeSide.BUY,  quantity: 40,  price:  47500, tradedAt: d('2024-01-30'), reason: '카카오페이 분기 흑자전환 기대',               emotion: Emotion.NEWS_REACTION, tags: ['핀테크','인터넷'],   source: TradeSource.CSV_IMPORT },
  { ticker: '035720', side: TradeSide.BUY,  quantity: 20,  price:  44000, tradedAt: d('2024-03-12'), reason: '추가 하락, 물타기',                          emotion: Emotion.IMPULSIVE,     tags: ['인터넷'],           source: TradeSource.CHATBOT },
  { ticker: '035720', side: TradeSide.SELL, quantity: 60,  price:  44200, tradedAt: d('2024-05-20'), reason: '플랫폼 규제 리스크 현실화, 전량 손절',         emotion: Emotion.PLANNED,       tags: ['손절','리스크관리'], source: TradeSource.CHATBOT },
  { ticker: '035720', side: TradeSide.BUY,  quantity: 30,  price:  38500, tradedAt: d('2024-09-05'), reason: '역사적 저점 부근 재진입',                    emotion: Emotion.TECHNICAL,     tags: ['저점매수'],         source: TradeSource.CHATBOT },
  { ticker: '035720', side: TradeSide.SELL, quantity: 30,  price:  42000, tradedAt: d('2025-01-22'), reason: '단기 반등 후 정리',                          emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 현대차 (005380) ───────────────────────────────────────
  { ticker: '005380', side: TradeSide.BUY,  quantity: 10,  price: 235000, tradedAt: d('2024-02-20'), reason: '밸류에이션 매력, 중기 배당주',                emotion: Emotion.PLANNED,       tags: ['자동차','배당'],    source: TradeSource.CHATBOT },
  { ticker: '005380', side: TradeSide.BUY,  quantity: 5,   price: 222000, tradedAt: d('2024-05-07'), reason: '추가 조정 시 분할매수',                      emotion: Emotion.PLANNED,       tags: ['자동차','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '005380', side: TradeSide.SELL, quantity: 8,   price: 255000, tradedAt: d('2024-08-14'), reason: '목표가 도달, 일부 익절',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '005380', side: TradeSide.BUY,  quantity: 5,   price: 228000, tradedAt: d('2024-11-19'), reason: '미국 관세 우려 과매도, 추가 매수',            emotion: Emotion.TECHNICAL,     tags: ['자동차','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '005380', side: TradeSide.SELL, quantity: 12,  price: 242000, tradedAt: d('2025-02-28'), reason: '분기 실적 발표 전 차익 실현',                emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 기아 (000270) ─────────────────────────────────────────
  { ticker: '000270', side: TradeSide.BUY,  quantity: 20,  price:  92000, tradedAt: d('2024-03-04'), reason: 'ROE·배당 매력, 현대차 대비 저평가',           emotion: Emotion.PLANNED,       tags: ['자동차','가치투자'], source: TradeSource.CHATBOT },
  { ticker: '000270', side: TradeSide.BUY,  quantity: 10,  price:  85000, tradedAt: d('2024-07-08'), reason: '2차 분할매수',                               emotion: Emotion.PLANNED,       tags: ['자동차','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '000270', side: TradeSide.SELL, quantity: 15,  price: 102000, tradedAt: d('2024-10-17'), reason: '목표가 10만원 돌파, 절반 익절',               emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '000270', side: TradeSide.SELL, quantity: 15,  price:  96000, tradedAt: d('2025-01-10'), reason: '나머지 정리',                                emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── LG에너지솔루션 (373220) ───────────────────────────────
  { ticker: '373220', side: TradeSide.BUY,  quantity: 5,   price: 372000, tradedAt: d('2024-02-28'), reason: '전기차 캐즘 완화 조짐, 장기 보유 목적',       emotion: Emotion.PLANNED,       tags: ['배터리','전기차'],  source: TradeSource.CHATBOT },
  { ticker: '373220', side: TradeSide.BUY,  quantity: 3,   price: 348000, tradedAt: d('2024-05-14'), reason: '2차 분할매수',                               emotion: Emotion.PLANNED,       tags: ['배터리','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '373220', side: TradeSide.BUY,  quantity: 5,   price: 295000, tradedAt: d('2024-09-23'), reason: '추가 급락 시 추가 매수',                     emotion: Emotion.IMPULSIVE,     tags: ['배터리'],           source: TradeSource.CHATBOT },
  { ticker: '373220', side: TradeSide.SELL, quantity: 8,   price: 315000, tradedAt: d('2025-01-30'), reason: '일부 손실 감수 정리',                        emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },

  // ── 삼성SDI (006400) ──────────────────────────────────────
  { ticker: '006400', side: TradeSide.BUY,  quantity: 8,   price: 420000, tradedAt: d('2024-01-15'), reason: '전고체 배터리 기대감 선반영',                 emotion: Emotion.NEWS_REACTION, tags: ['배터리','전고체'],  source: TradeSource.CSV_IMPORT },
  { ticker: '006400', side: TradeSide.SELL, quantity: 8,   price: 378000, tradedAt: d('2024-04-30'), reason: '전기차 캐즘 장기화, 손절 결정',               emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },
  { ticker: '006400', side: TradeSide.BUY,  quantity: 10,  price: 310000, tradedAt: d('2024-09-09'), reason: '역사적 저점 근처 진입',                      emotion: Emotion.TECHNICAL,     tags: ['배터리','저점매수'], source: TradeSource.CHATBOT },
  { ticker: '006400', side: TradeSide.SELL, quantity: 10,  price: 340000, tradedAt: d('2025-02-03'), reason: '단기 반등 후 익절',                          emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 삼성바이오로직스 (207940) ─────────────────────────────
  { ticker: '207940', side: TradeSide.BUY,  quantity: 3,   price: 820000, tradedAt: d('2024-01-25'), reason: 'CDO 수주 모멘텀, 장기 성장주',                emotion: Emotion.PLANNED,       tags: ['바이오','CMO'],     source: TradeSource.CHATBOT },
  { ticker: '207940', side: TradeSide.BUY,  quantity: 2,   price: 780000, tradedAt: d('2024-05-20'), reason: '조정 시 추가 매수',                          emotion: Emotion.PLANNED,       tags: ['바이오','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '207940', side: TradeSide.SELL, quantity: 3,   price: 920000, tradedAt: d('2024-09-16'), reason: '목표가 도달, 일부 정리',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '207940', side: TradeSide.SELL, quantity: 2,   price: 890000, tradedAt: d('2025-01-06'), reason: '나머지 정리, 현금 확보',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 셀트리온 (068270) ─────────────────────────────────────
  { ticker: '068270', side: TradeSide.BUY,  quantity: 15,  price: 175000, tradedAt: d('2024-02-08'), reason: '셀트리온헬스케어 합병 기대',                  emotion: Emotion.NEWS_REACTION, tags: ['바이오'],           source: TradeSource.CSV_IMPORT },
  { ticker: '068270', side: TradeSide.BUY,  quantity: 10,  price: 162000, tradedAt: d('2024-05-03'), reason: '합병 후 조정 구간 추가 매수',                emotion: Emotion.PLANNED,       tags: ['바이오','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '068270', side: TradeSide.SELL, quantity: 25,  price: 195000, tradedAt: d('2024-10-14'), reason: '목표가 도달 전량 정리',                      emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '068270', side: TradeSide.BUY,  quantity: 12,  price: 180000, tradedAt: d('2025-01-20'), reason: '재진입',                                    emotion: Emotion.TECHNICAL,     tags: ['바이오'],           source: TradeSource.CHATBOT },

  // ── 크래프톤 (259960) ─────────────────────────────────────
  { ticker: '259960', side: TradeSide.BUY,  quantity: 5,   price: 235000, tradedAt: d('2024-03-15'), reason: 'BGMI 인도 트래픽 회복, 밸류 매력',            emotion: Emotion.PLANNED,       tags: ['게임'],             source: TradeSource.CHATBOT },
  { ticker: '259960', side: TradeSide.BUY,  quantity: 3,   price: 218000, tradedAt: d('2024-06-20'), reason: '2차 분할매수',                               emotion: Emotion.PLANNED,       tags: ['게임','분할매수'],  source: TradeSource.CHATBOT },
  { ticker: '259960', side: TradeSide.SELL, quantity: 8,   price: 268000, tradedAt: d('2024-11-25'), reason: '목표가 도달 전량 정리',                      emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '259960', side: TradeSide.BUY,  quantity: 4,   price: 245000, tradedAt: d('2025-02-10'), reason: '신작 기대감 재진입',                         emotion: Emotion.NEWS_REACTION, tags: ['게임'],             source: TradeSource.CHATBOT },

  // ── 엔씨소프트 (036570) ───────────────────────────────────
  { ticker: '036570', side: TradeSide.BUY,  quantity: 10,  price: 195000, tradedAt: d('2024-01-31'), reason: 'TL 글로벌 출시 기대, 저점 진입',              emotion: Emotion.FOMO,          tags: ['게임'],             source: TradeSource.CHATBOT },
  { ticker: '036570', side: TradeSide.SELL, quantity: 10,  price: 162000, tradedAt: d('2024-04-05'), reason: 'TL 흥행 부진, 손절 결정',                    emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },
  { ticker: '036570', side: TradeSide.BUY,  quantity: 8,   price: 148000, tradedAt: d('2024-07-19'), reason: '역사적 저점 부근 재진입',                    emotion: Emotion.TECHNICAL,     tags: ['게임','저점매수'],  source: TradeSource.CHATBOT },
  { ticker: '036570', side: TradeSide.SELL, quantity: 8,   price: 170000, tradedAt: d('2024-11-12'), reason: '반등 후 익절',                               emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 신한지주 (055550) ─────────────────────────────────────
  { ticker: '055550', side: TradeSide.BUY,  quantity: 30,  price:  41500, tradedAt: d('2024-02-01'), reason: '밸류업 정책 기대, 금융주 비중 확대',           emotion: Emotion.NEWS_REACTION, tags: ['금융','배당'],      source: TradeSource.CSV_IMPORT },
  { ticker: '055550', side: TradeSide.BUY,  quantity: 20,  price:  39800, tradedAt: d('2024-04-16'), reason: '2차 분할매수',                               emotion: Emotion.PLANNED,       tags: ['금융','분할매수'],  source: TradeSource.CHATBOT },
  { ticker: '055550', side: TradeSide.SELL, quantity: 25,  price:  48200, tradedAt: d('2024-08-22'), reason: '밸류업 기대 반영, 일부 익절',                 emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '055550', side: TradeSide.SELL, quantity: 25,  price:  46000, tradedAt: d('2025-01-17'), reason: '나머지 정리',                                emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── KB금융 (105560) ───────────────────────────────────────
  { ticker: '105560', side: TradeSide.BUY,  quantity: 20,  price:  62000, tradedAt: d('2024-02-22'), reason: '밸류업 정책 최대 수혜 기대',                  emotion: Emotion.NEWS_REACTION, tags: ['금융','밸류업'],    source: TradeSource.CHATBOT },
  { ticker: '105560', side: TradeSide.BUY,  quantity: 15,  price:  59500, tradedAt: d('2024-05-28'), reason: '조정 시 추가 매수',                          emotion: Emotion.PLANNED,       tags: ['금융','분할매수'],  source: TradeSource.CHATBOT },
  { ticker: '105560', side: TradeSide.SELL, quantity: 35,  price:  78000, tradedAt: d('2024-10-08'), reason: '목표가 도달, 전량 정리',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '105560', side: TradeSide.BUY,  quantity: 10,  price:  72000, tradedAt: d('2025-01-28'), reason: '재진입, 배당 목적',                          emotion: Emotion.PLANNED,       tags: ['금융','배당'],      source: TradeSource.CHATBOT },

  // ── POSCO홀딩스 (005490) ──────────────────────────────────
  { ticker: '005490', side: TradeSide.BUY,  quantity: 5,   price: 385000, tradedAt: d('2024-03-07'), reason: '철강 업황 반등 기대, 저평가 판단',            emotion: Emotion.PLANNED,       tags: ['철강','가치투자'],  source: TradeSource.CHATBOT },
  { ticker: '005490', side: TradeSide.SELL, quantity: 5,   price: 352000, tradedAt: d('2024-06-25'), reason: '중국 경기 부진 우려, 손절',                  emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },
  { ticker: '005490', side: TradeSide.BUY,  quantity: 8,   price: 310000, tradedAt: d('2024-10-01'), reason: '역사적 저평가, 재진입',                      emotion: Emotion.TECHNICAL,     tags: ['철강','저점매수'],  source: TradeSource.CHATBOT },
  { ticker: '005490', side: TradeSide.SELL, quantity: 8,   price: 345000, tradedAt: d('2025-02-18'), reason: '단기 반등 후 익절',                          emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── LG화학 (051910) ───────────────────────────────────────
  { ticker: '051910', side: TradeSide.BUY,  quantity: 5,   price: 320000, tradedAt: d('2024-04-02'), reason: '배터리 소재 장기 성장, 저점 분할매수',         emotion: Emotion.PLANNED,       tags: ['화학','배터리소재'], source: TradeSource.CHATBOT },
  { ticker: '051910', side: TradeSide.BUY,  quantity: 5,   price: 290000, tradedAt: d('2024-07-16'), reason: '2차 분할매수',                               emotion: Emotion.PLANNED,       tags: ['화학','분할매수'],  source: TradeSource.CHATBOT },
  { ticker: '051910', side: TradeSide.SELL, quantity: 10,  price: 265000, tradedAt: d('2025-01-13'), reason: '목표가 미달, 손실 감수 정리',                 emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },

  // ── SK텔레콤 (017670) ─────────────────────────────────────
  { ticker: '017670', side: TradeSide.BUY,  quantity: 25,  price:  50500, tradedAt: d('2024-03-19'), reason: '통신주 배당 목적 장기 보유',                  emotion: Emotion.PLANNED,       tags: ['통신','배당'],      source: TradeSource.CSV_IMPORT },
  { ticker: '017670', side: TradeSide.SELL, quantity: 25,  price:  55200, tradedAt: d('2024-09-26'), reason: '목표 수익률 도달, 익절',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '017670', side: TradeSide.BUY,  quantity: 20,  price:  52000, tradedAt: d('2025-01-05'), reason: '재진입, 고배당 매력 유지',                   emotion: Emotion.PLANNED,       tags: ['통신','배당'],      source: TradeSource.CHATBOT },

  // ── 한국전력 (015760) ─────────────────────────────────────
  { ticker: '015760', side: TradeSide.BUY,  quantity: 100, price:  18500, tradedAt: d('2024-02-15'), reason: '요금 인상 기대, 턴어라운드 플레이',            emotion: Emotion.NEWS_REACTION, tags: ['유틸리티'],         source: TradeSource.CSV_IMPORT },
  { ticker: '015760', side: TradeSide.SELL, quantity: 100, price:  21300, tradedAt: d('2024-06-04'), reason: '요금 인상 현실화, 목표가 익절',               emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '015760', side: TradeSide.BUY,  quantity: 80,  price:  19800, tradedAt: d('2024-09-12'), reason: '재진입, 2차 인상 기대',                      emotion: Emotion.PLANNED,       tags: ['유틸리티'],         source: TradeSource.CHATBOT },
  { ticker: '015760', side: TradeSide.SELL, quantity: 80,  price:  22500, tradedAt: d('2025-02-25'), reason: '목표가 도달, 전량 익절',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 포스코퓨처엠 (003670) ─────────────────────────────────
  { ticker: '003670', side: TradeSide.BUY,  quantity: 10,  price: 285000, tradedAt: d('2024-04-11'), reason: '양극재 수주 확대 기대',                      emotion: Emotion.NEWS_REACTION, tags: ['배터리소재'],       source: TradeSource.CHATBOT },
  { ticker: '003670', side: TradeSide.SELL, quantity: 10,  price: 245000, tradedAt: d('2024-08-28'), reason: '전기차 수요 둔화, 손절',                     emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },
  { ticker: '003670', side: TradeSide.BUY,  quantity: 12,  price: 210000, tradedAt: d('2024-11-06'), reason: '저점 재진입',                                emotion: Emotion.TECHNICAL,     tags: ['배터리소재','저점매수'], source: TradeSource.CHATBOT },
  { ticker: '003670', side: TradeSide.SELL, quantity: 12,  price: 238000, tradedAt: d('2025-03-11'), reason: '반등 후 익절',                               emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 삼성생명 (032830) ─────────────────────────────────────
  { ticker: '032830', side: TradeSide.BUY,  quantity: 15,  price:  78000, tradedAt: d('2024-03-28'), reason: '밸류업 프로그램 보험주 기대',                 emotion: Emotion.NEWS_REACTION, tags: ['보험','밸류업'],    source: TradeSource.CHATBOT },
  { ticker: '032830', side: TradeSide.SELL, quantity: 15,  price:  90000, tradedAt: d('2024-08-01'), reason: '목표가 도달, 전량 익절',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 현대모비스 (012330) ───────────────────────────────────
  { ticker: '012330', side: TradeSide.BUY,  quantity: 8,   price: 225000, tradedAt: d('2024-05-02'), reason: '전동화 부품 수주 증가, 저평가',               emotion: Emotion.PLANNED,       tags: ['자동차부품'],       source: TradeSource.CHATBOT },
  { ticker: '012330', side: TradeSide.BUY,  quantity: 5,   price: 210000, tradedAt: d('2024-07-23'), reason: '2차 분할매수',                               emotion: Emotion.PLANNED,       tags: ['자동차부품','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '012330', side: TradeSide.SELL, quantity: 13,  price: 248000, tradedAt: d('2025-01-09'), reason: '목표가 도달, 전량 정리',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 카카오뱅크 (323410) ───────────────────────────────────
  { ticker: '323410', side: TradeSide.BUY,  quantity: 30,  price:  25000, tradedAt: d('2024-04-18'), reason: '인터넷은행 MAU 성장, 저평가 기대',            emotion: Emotion.PLANNED,       tags: ['핀테크','인터넷은행'], source: TradeSource.CHATBOT },
  { ticker: '323410', side: TradeSide.SELL, quantity: 30,  price:  28500, tradedAt: d('2024-10-29'), reason: '단기 급등 후 익절',                          emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '323410', side: TradeSide.BUY,  quantity: 25,  price:  22000, tradedAt: d('2025-02-06'), reason: '재진입, 성장 스토리 유효',                   emotion: Emotion.PLANNED,       tags: ['핀테크'],           source: TradeSource.CHATBOT },

  // ── 한국가스공사 (036460) ─────────────────────────────────
  { ticker: '036460', side: TradeSide.BUY,  quantity: 20,  price:  38000, tradedAt: d('2024-05-09'), reason: '천연가스 가격 안정, 배당 매력',               emotion: Emotion.PLANNED,       tags: ['에너지','배당'],    source: TradeSource.CSV_IMPORT },
  { ticker: '036460', side: TradeSide.SELL, quantity: 20,  price:  42000, tradedAt: d('2024-09-02'), reason: '목표 수익률 도달, 익절',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── SK이노베이션 (096770) ─────────────────────────────────
  { ticker: '096770', side: TradeSide.BUY,  quantity: 10,  price: 105000, tradedAt: d('2024-06-03'), reason: 'SK온 IPO 기대, 지주 할인 해소 예상',          emotion: Emotion.NEWS_REACTION, tags: ['에너지','배터리'],  source: TradeSource.CHATBOT },
  { ticker: '096770', side: TradeSide.SELL, quantity: 10,  price:  98000, tradedAt: d('2024-09-17'), reason: 'SK온 IPO 연기, 손절',                        emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },

  // ── 삼성에스디에스 (018260) ───────────────────────────────
  { ticker: '018260', side: TradeSide.BUY,  quantity: 8,   price: 148000, tradedAt: d('2024-06-17'), reason: 'IT서비스·물류 안정 수익, 배당주',             emotion: Emotion.PLANNED,       tags: ['IT서비스','배당'],  source: TradeSource.CHATBOT },
  { ticker: '018260', side: TradeSide.SELL, quantity: 8,   price: 162000, tradedAt: d('2024-11-04'), reason: '목표가 도달, 익절',                          emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── LG전자 (066570) ───────────────────────────────────────
  { ticker: '066570', side: TradeSide.BUY,  quantity: 15,  price:  92000, tradedAt: d('2024-07-01'), reason: '전장·OLED TV 실적 회복 기대',                emotion: Emotion.PLANNED,       tags: ['전기전자'],         source: TradeSource.CHATBOT },
  { ticker: '066570', side: TradeSide.BUY,  quantity: 10,  price:  85000, tradedAt: d('2024-09-25'), reason: '2차 분할매수',                               emotion: Emotion.PLANNED,       tags: ['전기전자','분할매수'], source: TradeSource.CHATBOT },
  { ticker: '066570', side: TradeSide.SELL, quantity: 25,  price:  97000, tradedAt: d('2025-01-03'), reason: '연초 리밸런싱, 전량 익절',                   emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 우리금융지주 (316140) ─────────────────────────────────
  { ticker: '316140', side: TradeSide.BUY,  quantity: 40,  price:  14200, tradedAt: d('2024-07-10'), reason: '고배당 저PBR, 밸류업 수혜 예상',              emotion: Emotion.PLANNED,       tags: ['금융','배당','밸류업'], source: TradeSource.CHATBOT },
  { ticker: '316140', side: TradeSide.SELL, quantity: 40,  price:  17500, tradedAt: d('2024-12-19'), reason: '목표가 도달, 전량 익절',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },
  { ticker: '316140', side: TradeSide.BUY,  quantity: 35,  price:  15800, tradedAt: d('2025-02-17'), reason: '재진입, 배당 재확보',                        emotion: Emotion.PLANNED,       tags: ['금융','배당'],      source: TradeSource.CHATBOT },

  // ── 유한양행 (000100) ─────────────────────────────────────
  { ticker: '000100', side: TradeSide.BUY,  quantity: 10,  price:  78000, tradedAt: d('2024-08-12'), reason: 'FDA 허가 파이프라인 기대',                   emotion: Emotion.NEWS_REACTION, tags: ['제약'],             source: TradeSource.CHATBOT },
  { ticker: '000100', side: TradeSide.SELL, quantity: 10,  price:  95000, tradedAt: d('2024-12-10'), reason: '파이프라인 발표 후 목표가 달성, 익절',        emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 하나금융지주 (086790) ─────────────────────────────────
  { ticker: '086790', side: TradeSide.BUY,  quantity: 20,  price:  56000, tradedAt: d('2024-08-26'), reason: '실적 안정, 배당 증가 기대',                  emotion: Emotion.PLANNED,       tags: ['금융','배당'],      source: TradeSource.CHATBOT },
  { ticker: '086790', side: TradeSide.SELL, quantity: 20,  price:  65000, tradedAt: d('2025-02-20'), reason: '연간 배당 확인 후 익절',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 넷마블 (251270) ───────────────────────────────────────
  { ticker: '251270', side: TradeSide.BUY,  quantity: 15,  price:  52000, tradedAt: d('2024-09-30'), reason: '신작 라인업 기대, 저PBR 반등 노림',           emotion: Emotion.FOMO,          tags: ['게임'],             source: TradeSource.CHATBOT },
  { ticker: '251270', side: TradeSide.SELL, quantity: 15,  price:  48000, tradedAt: d('2025-01-21'), reason: '신작 기대 실망, 손절',                       emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },

  // ── 카카오페이 (377300) ───────────────────────────────────
  { ticker: '377300', side: TradeSide.BUY,  quantity: 25,  price:  32000, tradedAt: d('2024-10-14'), reason: '페이먼트 수익화 가속, 저점 진입',             emotion: Emotion.PLANNED,       tags: ['핀테크'],           source: TradeSource.CHATBOT },
  { ticker: '377300', side: TradeSide.SELL, quantity: 25,  price:  29000, tradedAt: d('2025-03-04'), reason: '규제 우려 재부각, 손절',                     emotion: Emotion.PLANNED,       tags: ['손절'],             source: TradeSource.CHATBOT },

  // ── 기업은행 (024110) ─────────────────────────────────────
  { ticker: '024110', side: TradeSide.BUY,  quantity: 50,  price:  13500, tradedAt: d('2024-11-18'), reason: '정부 배당 정책 강화, 고배당 수혜',            emotion: Emotion.NEWS_REACTION, tags: ['금융','배당'],      source: TradeSource.CSV_IMPORT },
  { ticker: '024110', side: TradeSide.SELL, quantity: 50,  price:  15800, tradedAt: d('2025-03-25'), reason: '배당 수익 확보 후 익절',                     emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── LG (003550) ───────────────────────────────────────────
  { ticker: '003550', side: TradeSide.BUY,  quantity: 15,  price:  75000, tradedAt: d('2024-12-02'), reason: '지주사 할인 축소 기대, 저평가',               emotion: Emotion.PLANNED,       tags: ['지주','가치투자'],  source: TradeSource.CHATBOT },
  { ticker: '003550', side: TradeSide.BUY,  quantity: 10,  price:  71000, tradedAt: d('2025-01-27'), reason: '2차 분할매수',                               emotion: Emotion.PLANNED,       tags: ['지주','분할매수'],  source: TradeSource.CHATBOT },

  // ── SK (034730) ───────────────────────────────────────────
  { ticker: '034730', side: TradeSide.BUY,  quantity: 5,   price: 162000, tradedAt: d('2024-12-16'), reason: 'SK하이닉스 가치 반영, 지주 재평가 기대',      emotion: Emotion.PLANNED,       tags: ['지주'],             source: TradeSource.CHATBOT },
  { ticker: '034730', side: TradeSide.SELL, quantity: 5,   price: 178000, tradedAt: d('2025-03-18'), reason: '목표가 도달, 익절',                          emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── 삼성물산 (028260) ─────────────────────────────────────
  { ticker: '028260', side: TradeSide.BUY,  quantity: 10,  price: 112000, tradedAt: d('2025-01-14'), reason: '건설·패션·바이오 복합 저평가, 밸류업',        emotion: Emotion.PLANNED,       tags: ['건설지주','밸류업'], source: TradeSource.CHATBOT },
  { ticker: '028260', side: TradeSide.BUY,  quantity: 5,   price: 108000, tradedAt: d('2025-02-24'), reason: '2차 분할매수',                               emotion: Emotion.PLANNED,       tags: ['건설지주','분할매수'], source: TradeSource.CHATBOT },

  // ── 한화생명 (088350) ─────────────────────────────────────
  { ticker: '088350', side: TradeSide.BUY,  quantity: 60,  price:   3200, tradedAt: d('2025-02-07'), reason: '보험주 PBR 0.3배, 극단적 저평가',             emotion: Emotion.PLANNED,       tags: ['보험','가치투자'],  source: TradeSource.CHATBOT },
  { ticker: '088350', side: TradeSide.SELL, quantity: 60,  price:   3800, tradedAt: d('2025-03-28'), reason: '단기 반등 후 익절',                          emotion: Emotion.PLANNED,       tags: ['익절'],             source: TradeSource.CHATBOT },

  // ── KT (030200) ───────────────────────────────────────────
  { ticker: '030200', side: TradeSide.BUY,  quantity: 30,  price:  38500, tradedAt: d('2025-02-19'), reason: 'AI·데이터센터 사업 확장 기대',                emotion: Emotion.NEWS_REACTION, tags: ['통신','AI'],        source: TradeSource.CHATBOT },

  // ── LG유플러스 (032640) ───────────────────────────────────
  { ticker: '032640', side: TradeSide.BUY,  quantity: 40,  price:  10200, tradedAt: d('2025-03-07'), reason: '통신 3사 중 최저 PBR, 배당 안정',             emotion: Emotion.PLANNED,       tags: ['통신','배당'],      source: TradeSource.CHATBOT },
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
      const totalQty = cur.qty + t.quantity;
      cur.cost = (cur.qty * cur.cost + t.quantity * t.price) / totalQty;
      cur.qty = totalQty;
    } else {
      cur.realizedPnl += (t.price - cur.cost) * t.quantity;
      cur.qty -= t.quantity;
    }
    posMap.set(t.ticker, cur);
  }

  let posCount = 0;
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
    posCount++;
  }
  console.log(`✅ 포지션 ${posCount}건 삽입`);

  await AppDataSource.destroy();
  console.log('\n🎉 데모 시드 완료!');
  console.log(`   이메일: ${DEMO_EMAIL}`);
  console.log(`   비밀번호: ${DEMO_PASSWORD}`);
  console.log(`   총 거래: ${TRADES.length}건 / 종목: ${[...new Set(TRADES.map((t) => t.ticker))].length}개`);
}

main().catch((e) => { console.error(e); process.exit(1); });
