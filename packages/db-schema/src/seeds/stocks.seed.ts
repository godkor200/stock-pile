import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { StockEntity } from '../entities/stock.entity';
import { Market } from '@stock-pile/shared-types';

interface StockRow {
  ticker: string;
  name: string;
  market: Market;
  sector: string;
}

const STOCKS: StockRow[] = [
  // ── KOSPI ─────────────────────────────────────────────────────
  { ticker: '005930', name: '삼성전자',            market: Market.KOSPI,  sector: '반도체' },
  { ticker: '000660', name: 'SK하이닉스',          market: Market.KOSPI,  sector: '반도체' },
  { ticker: '005380', name: '현대자동차',           market: Market.KOSPI,  sector: '자동차' },
  { ticker: '000270', name: '기아',                market: Market.KOSPI,  sector: '자동차' },
  { ticker: '005490', name: 'POSCO홀딩스',         market: Market.KOSPI,  sector: '철강' },
  { ticker: '003670', name: '포스코퓨처엠',        market: Market.KOSPI,  sector: '배터리소재' },
  { ticker: '051910', name: 'LG화학',              market: Market.KOSPI,  sector: '화학' },
  { ticker: '006400', name: '삼성SDI',             market: Market.KOSPI,  sector: '배터리' },
  { ticker: '373220', name: 'LG에너지솔루션',      market: Market.KOSPI,  sector: '배터리' },
  { ticker: '028260', name: '삼성물산',            market: Market.KOSPI,  sector: '건설·지주' },
  { ticker: '012330', name: '현대모비스',           market: Market.KOSPI,  sector: '자동차부품' },
  { ticker: '066570', name: 'LG전자',              market: Market.KOSPI,  sector: '전기·전자' },
  { ticker: '003550', name: 'LG',                  market: Market.KOSPI,  sector: '지주' },
  { ticker: '034730', name: 'SK',                  market: Market.KOSPI,  sector: '지주' },
  { ticker: '055550', name: '신한지주',            market: Market.KOSPI,  sector: '금융' },
  { ticker: '105560', name: 'KB금융',              market: Market.KOSPI,  sector: '금융' },
  { ticker: '086790', name: '하나금융지주',        market: Market.KOSPI,  sector: '금융' },
  { ticker: '316140', name: '우리금융지주',        market: Market.KOSPI,  sector: '금융' },
  { ticker: '024110', name: '기업은행',            market: Market.KOSPI,  sector: '금융' },
  { ticker: '032830', name: '삼성생명',            market: Market.KOSPI,  sector: '보험' },
  { ticker: '000810', name: '삼성화재',            market: Market.KOSPI,  sector: '보험' },
  { ticker: '088350', name: '한화생명',            market: Market.KOSPI,  sector: '보험' },
  { ticker: '017670', name: 'SK텔레콤',            market: Market.KOSPI,  sector: '통신' },
  { ticker: '030200', name: 'KT',                  market: Market.KOSPI,  sector: '통신' },
  { ticker: '032640', name: 'LG유플러스',          market: Market.KOSPI,  sector: '통신' },
  { ticker: '035420', name: 'NAVER',               market: Market.KOSPI,  sector: 'IT' },
  { ticker: '035720', name: '카카오',              market: Market.KOSPI,  sector: 'IT' },
  { ticker: '323410', name: '카카오뱅크',          market: Market.KOSPI,  sector: '핀테크' },
  { ticker: '377300', name: '카카오페이',          market: Market.KOSPI,  sector: '핀테크' },
  { ticker: '018260', name: '삼성에스디에스',      market: Market.KOSPI,  sector: 'IT서비스' },
  { ticker: '096770', name: 'SK이노베이션',        market: Market.KOSPI,  sector: '에너지' },
  { ticker: '036460', name: '한국가스공사',        market: Market.KOSPI,  sector: '에너지' },
  { ticker: '015760', name: '한국전력',            market: Market.KOSPI,  sector: '유틸리티' },
  { ticker: '207940', name: '삼성바이오로직스',    market: Market.KOSPI,  sector: '바이오' },
  { ticker: '068270', name: '셀트리온',            market: Market.KOSPI,  sector: '바이오' },
  { ticker: '000100', name: '유한양행',            market: Market.KOSPI,  sector: '제약' },
  { ticker: '259960', name: '크래프톤',            market: Market.KOSPI,  sector: '게임' },
  { ticker: '036570', name: '엔씨소프트',          market: Market.KOSPI,  sector: '게임' },
  { ticker: '251270', name: '넷마블',              market: Market.KOSPI,  sector: '게임' },
  { ticker: '009150', name: '삼성전기',            market: Market.KOSPI,  sector: '전기·전자' },
  { ticker: '003490', name: '대한항공',            market: Market.KOSPI,  sector: '항공' },
  { ticker: '011200', name: 'HMM',                 market: Market.KOSPI,  sector: '해운' },
  { ticker: '004020', name: '현대제철',            market: Market.KOSPI,  sector: '철강' },
  { ticker: '010130', name: '고려아연',            market: Market.KOSPI,  sector: '소재' },
  { ticker: '011170', name: '롯데케미칼',          market: Market.KOSPI,  sector: '화학' },
  { ticker: '004990', name: '롯데지주',            market: Market.KOSPI,  sector: '지주' },
  { ticker: '139480', name: '이마트',              market: Market.KOSPI,  sector: '유통' },
  { ticker: '021240', name: '코웨이',              market: Market.KOSPI,  sector: '가전' },
  { ticker: '000880', name: '한화',                market: Market.KOSPI,  sector: '방산·화학' },
  { ticker: '012450', name: '한화에어로스페이스',  market: Market.KOSPI,  sector: '방산' },
  { ticker: '161390', name: '한국타이어앤테크놀로지', market: Market.KOSPI, sector: '자동차부품' },
  { ticker: '011780', name: '금호석유',            market: Market.KOSPI,  sector: '화학' },
  { ticker: '000990', name: 'DB하이텍',            market: Market.KOSPI,  sector: '반도체' },

  // ── KOSDAQ ────────────────────────────────────────────────────
  { ticker: '247540', name: '에코프로비엠',        market: Market.KOSDAQ, sector: '배터리소재' },
  { ticker: '086520', name: '에코프로',            market: Market.KOSDAQ, sector: '배터리소재' },
  { ticker: '066970', name: '엘앤에프',            market: Market.KOSDAQ, sector: '배터리소재' },
  { ticker: '293490', name: '카카오게임즈',        market: Market.KOSDAQ, sector: '게임' },
  { ticker: '263750', name: '펄어비스',            market: Market.KOSDAQ, sector: '게임' },
  { ticker: '091990', name: '셀트리온헬스케어',    market: Market.KOSDAQ, sector: '바이오' },
  { ticker: '028300', name: 'HLB',                 market: Market.KOSDAQ, sector: '바이오' },
  { ticker: '196170', name: '알테오젠',            market: Market.KOSDAQ, sector: '바이오' },
  { ticker: '058470', name: '리노공업',            market: Market.KOSDAQ, sector: '반도체부품' },
  { ticker: '277810', name: '레인보우로보틱스',    market: Market.KOSDAQ, sector: '로봇' },
  { ticker: '035900', name: 'JYP Ent.',            market: Market.KOSDAQ, sector: '엔터' },
  { ticker: '041510', name: 'SM엔터테인먼트',      market: Market.KOSDAQ, sector: '엔터' },
  { ticker: '352820', name: '하이브',              market: Market.KOSPI,  sector: '엔터' },
  { ticker: '122870', name: '와이지엔터테인먼트',  market: Market.KOSDAQ, sector: '엔터' },
  { ticker: '357780', name: '솔브레인',            market: Market.KOSDAQ, sector: '반도체소재' },
  { ticker: '039030', name: '이오테크닉스',        market: Market.KOSDAQ, sector: '반도체장비' },
  { ticker: '236340', name: '스노우플레이크',      market: Market.KOSDAQ, sector: '소프트웨어' },
];

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(StockEntity);

  await repo.upsert(STOCKS, { conflictPaths: ['ticker'], skipUpdateIfNoValuesChanged: true });

  console.log(`✅ ${STOCKS.length}개 종목 시드 완료`);
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('시드 실패:', err);
  process.exit(1);
});
