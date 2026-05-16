import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatInputService } from './chat-input.service';
import { ParsedTradeFromChat } from '@stock-pile/shared-types';

// ── fetch mock ─────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockGroqResponse(content: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  });
}

function mockGroqError(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Internal Server Error',
  });
}

// ── 서비스 팩토리 ───────────────────────────────────────────────────────────

async function buildService(): Promise<ChatInputService> {
  const module = await Test.createTestingModule({
    providers: [
      ChatInputService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, def?: unknown) => {
            const cfg: Record<string, string> = {
              LLM_PROVIDER: 'groq',
              GROQ_API_KEY: 'test-key',
              GROQ_MODEL: 'llama-3.1-8b-instant',
              ANTHROPIC_API_KEY: '',
            };
            return cfg[key] ?? def;
          },
        },
      },
    ],
  }).compile();
  return module.get(ChatInputService);
}

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

/** LLM이 반환할 JSON 문자열을 만들어 mock에 주입한 뒤 parse() 결과를 반환 */
async function parse(svc: ChatInputService, llmJson: object): Promise<ParsedTradeFromChat> {
  mockGroqResponse(JSON.stringify(llmJson));
  return svc.parse('dummy input');
}

// ── 테스트 스위트 ────────────────────────────────────────────────────────────

describe('ChatInputService.parse() — extractParsed 로직', () => {
  let svc: ChatInputService;

  beforeAll(async () => {
    svc = await buildService();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  // ── 1. 완전한 BUY 거래 ────────────────────────────────────────────────────

  test('1. BUY + 삼성전자 + 수량/가격 모두 있으면 confidence 0.9', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '삼성전자',
      ticker: '005930',
      quantity: 10,
      quantityUnit: 'SHARES',
      price: 72000,
      useMarketPrice: false,
      reason: '실적 기대',
      emotion: 'PLANNED',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.side).toBe('BUY');
    expect(result.stockQuery).toBe('삼성전자');
    expect(result.ticker).toBe('005930');
    expect(result.quantity).toBe(10);
    expect(result.price).toBe(72000);
    expect(result.useMarketPrice).toBe(false);
    expect(result.reason).toBe('실적 기대');
    expect(result.emotion).toBe('PLANNED');
    expect(result.confidence).toBe(0.9);
    expect(result.missingFields).toHaveLength(0);
  });

  // ── 2. 완전한 SELL 거래 ──────────────────────────────────────────────────

  test('2. SELL + 카카오 + 수량/가격 완전 → side SELL 반환', async () => {
    const result = await parse(svc, {
      side: 'SELL',
      stockQuery: '카카오',
      ticker: '035720',
      quantity: 50,
      quantityUnit: 'SHARES',
      price: 58000,
      useMarketPrice: false,
      reason: null,
      emotion: 'IMPULSIVE',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.side).toBe('SELL');
    expect(result.ticker).toBe('035720');
    expect(result.quantity).toBe(50);
    expect(result.emotion).toBe('IMPULSIVE');
  });

  // ── 3. 삼전우(우선주) ────────────────────────────────────────────────────

  test('3. 삼전우 1300원 100주 BUY → ticker 005935', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '삼전우',
      ticker: '005935',
      quantity: 100,
      quantityUnit: 'SHARES',
      price: 1300,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('005935');
    expect(result.price).toBe(1300);
    expect(result.quantity).toBe(100);
  });

  // ── 4. 시장가 매수 (price 없음) ──────────────────────────────────────────

  test('4. price 없으면 useMarketPrice true 반환', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: 'SK하이닉스',
      ticker: '000660',
      quantity: 5,
      quantityUnit: 'SHARES',
      price: null,
      useMarketPrice: true,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.useMarketPrice).toBe(true);
    expect(result.price).toBeUndefined();
  });

  // ── 5. 금액 단위 매수 ────────────────────────────────────────────────────

  test('5. 200만원어치 AAPL → quantityUnit AMOUNT', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '애플',
      ticker: 'AAPL',
      quantity: 2000000,
      quantityUnit: 'AMOUNT',
      price: null,
      useMarketPrice: true,
      reason: null,
      emotion: 'FOMO',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.quantityUnit).toBe('AMOUNT');
    expect(result.quantity).toBe(2000000);
    expect(result.emotion).toBe('FOMO');
  });

  // ── 6. side 누락 → missingFields 포함 ───────────────────────────────────

  test('6. side 누락 → missingFields에 side 포함, confidence 0.6', async () => {
    const result = await parse(svc, {
      side: null,
      stockQuery: '현대차',
      ticker: '005380',
      quantity: 20,
      quantityUnit: 'SHARES',
      price: null,
      useMarketPrice: true,
      reason: null,
      emotion: null,
      confidence: 0.6,
      missingFields: ['side'],
      clarificationQuestion: '매수/매도 중 어느 쪽인가요?',
    });

    expect(result.side).toBeNull();
    expect(result.missingFields).toContain('side');
    expect(result.clarificationQuestion).toBeTruthy();
  });

  // ── 7. quantity 누락 ─────────────────────────────────────────────────────

  test('7. quantity 누락 → missingFields에 quantity 포함', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: 'TSLA',
      ticker: 'TSLA',
      quantity: null,
      quantityUnit: 'SHARES',
      price: 250,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.6,
      missingFields: ['quantity'],
      clarificationQuestion: '몇 주 매수하셨나요?',
    });

    expect(result.quantity).toBeUndefined();
    expect(result.missingFields).toContain('quantity');
  });

  // ── 8. stockQuery 누락 ───────────────────────────────────────────────────

  test('8. stockQuery 누락 → missingFields에 stockQuery 포함', async () => {
    const result = await parse(svc, {
      side: 'SELL',
      stockQuery: '',
      ticker: null,
      quantity: 3,
      quantityUnit: 'SHARES',
      price: null,
      useMarketPrice: true,
      reason: null,
      emotion: null,
      confidence: 0.6,
      missingFields: ['stockQuery'],
      clarificationQuestion: '어떤 종목을 매도하셨나요?',
    });

    expect(result.stockQuery).toBe('');
    expect(result.missingFields).toContain('stockQuery');
  });

  // ── 9. 모든 핵심 필드 누락 ──────────────────────────────────────────────

  test('9. side+stockQuery+quantity 모두 누락 → confidence 0, clarification 있음', async () => {
    const result = await parse(svc, {
      side: null,
      stockQuery: '',
      ticker: null,
      quantity: null,
      quantityUnit: 'SHARES',
      price: null,
      useMarketPrice: true,
      reason: null,
      emotion: null,
      confidence: 0,
      missingFields: ['side', 'stockQuery', 'quantity'],
      clarificationQuestion: '매수/매도 여부, 종목명, 수량을 알려주세요.',
    });

    expect(result.confidence).toBe(0);
    expect(result.missingFields).toHaveLength(3);
  });

  // ── 10. 이유(reason) 파싱 ───────────────────────────────────────────────

  test('10. reason 필드 정상 파싱', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: 'NVDA',
      ticker: 'NVDA',
      quantity: 2,
      quantityUnit: 'SHARES',
      price: 900,
      useMarketPrice: false,
      reason: 'AI 수요 증가 기대',
      emotion: 'TECHNICAL',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.reason).toBe('AI 수요 증가 기대');
    expect(result.emotion).toBe('TECHNICAL');
  });

  // ── 11. 뉴스 반응 emotion ────────────────────────────────────────────────

  test('11. emotion NEWS_REACTION 파싱', async () => {
    const result = await parse(svc, {
      side: 'SELL',
      stockQuery: 'NAVER',
      ticker: '035420',
      quantity: 10,
      quantityUnit: 'SHARES',
      price: 180000,
      useMarketPrice: false,
      reason: '악재 뉴스 나와서',
      emotion: 'NEWS_REACTION',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.emotion).toBe('NEWS_REACTION');
  });

  // ── 12. FOMO emotion ─────────────────────────────────────────────────────

  test('12. emotion FOMO 파싱', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '비트코인ETF',
      ticker: null,
      quantity: 5,
      quantityUnit: 'SHARES',
      price: null,
      useMarketPrice: true,
      reason: '다들 오른다고 해서',
      emotion: 'FOMO',
      confidence: 0.6,
      missingFields: ['ticker'],
      clarificationQuestion: null,
    });

    expect(result.emotion).toBe('FOMO');
  });

  // ── 13. 해외 주식 ticker 그대로 ─────────────────────────────────────────

  test('13. TSLA 티커 그대로 반환', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '테슬라',
      ticker: 'TSLA',
      quantity: 1,
      quantityUnit: 'SHARES',
      price: 180,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('TSLA');
  });

  // ── 14. ticker undefined (불명확한 종목) ────────────────────────────────

  test('14. ticker 불명확 → ticker undefined', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '반도체 ETF',
      ticker: null,
      quantity: 10,
      quantityUnit: 'SHARES',
      price: null,
      useMarketPrice: true,
      reason: null,
      emotion: null,
      confidence: 0.6,
      missingFields: ['ticker'],
      clarificationQuestion: '어떤 반도체 ETF를 매수하셨나요?',
    });

    expect(result.ticker).toBeUndefined();
  });

  // ── 15. LG에너지솔루션 ──────────────────────────────────────────────────

  test('15. LG에너지솔루션 373220 파싱', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: 'LG에너지솔루션',
      ticker: '373220',
      quantity: 3,
      quantityUnit: 'SHARES',
      price: 420000,
      useMarketPrice: false,
      reason: null,
      emotion: 'PLANNED',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('373220');
    expect(result.price).toBe(420000);
  });

  // ── 16. 고가 종목 (주당 수백만원) ───────────────────────────────────────

  test('16. 삼성바이오로직스 고가 파싱', async () => {
    const result = await parse(svc, {
      side: 'SELL',
      stockQuery: '삼성바이오로직스',
      ticker: '207940',
      quantity: 1,
      quantityUnit: 'SHARES',
      price: 850000,
      useMarketPrice: false,
      reason: '목표가 달성',
      emotion: 'PLANNED',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.price).toBe(850000);
    expect(result.quantity).toBe(1);
  });

  // ── 17. 소액 우선주 매수 ─────────────────────────────────────────────────

  test('17. 현대차우 우선주 ticker 파싱', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '현대차우',
      ticker: '005385',
      quantity: 20,
      quantityUnit: 'SHARES',
      price: 98000,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('005385');
  });

  // ── 18. 만 원 단위 금액 매수 ─────────────────────────────────────────────

  test('18. 100만원어치 → quantity 1000000 AMOUNT', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '기아',
      ticker: '000270',
      quantity: 1000000,
      quantityUnit: 'AMOUNT',
      price: null,
      useMarketPrice: true,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.quantityUnit).toBe('AMOUNT');
    expect(result.quantity).toBe(1000000);
  });

  // ── 19. JSON에 불필요한 텍스트 포함 ─────────────────────────────────────

  test('19. LLM 응답에 설명 텍스트 포함돼도 JSON 추출 성공', async () => {
    const jsonPart = JSON.stringify({
      side: 'BUY',
      stockQuery: '포스코홀딩스',
      ticker: '005490',
      quantity: 5,
      quantityUnit: 'SHARES',
      price: 330000,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });
    mockGroqResponse(`아래와 같이 파싱했습니다:\n${jsonPart}\n이상입니다.`);
    const result = await svc.parse('포스코홀딩스 5주 33만원에 샀어');

    expect(result.side).toBe('BUY');
    expect(result.ticker).toBe('005490');
  });

  // ── 20. JSON 없는 응답 → emptyParsed ────────────────────────────────────

  test('20. JSON 없는 응답 → emptyParsed 반환', async () => {
    mockGroqResponse('죄송합니다, 이해하지 못했습니다.');
    const result = await svc.parse('아무 말');

    expect(result.side).toBeNull();
    expect(result.stockQuery).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.missingFields).toContain('side');
  });

  // ── 21. 깨진 JSON → emptyParsed ─────────────────────────────────────────

  test('21. 깨진 JSON → emptyParsed 반환', async () => {
    mockGroqResponse('{ side: BUY, quantity: 10 ');
    const result = await svc.parse('깨진 응답');

    expect(result.side).toBeNull();
    expect(result.confidence).toBe(0);
  });

  // ── 22. API 에러 → throw ─────────────────────────────────────────────────

  test('22. Groq API 500 에러 → Error throw', async () => {
    mockGroqError(500);
    await expect(svc.parse('삼성전자 10주 매수')).rejects.toThrow('LLM API error');
  });

  // ── 23. POSCO 홀딩스 분할 매수 ──────────────────────────────────────────

  test('23. 셀트리온 068270 SELL', async () => {
    const result = await parse(svc, {
      side: 'SELL',
      stockQuery: '셀트리온',
      ticker: '068270',
      quantity: 30,
      quantityUnit: 'SHARES',
      price: 195000,
      useMarketPrice: false,
      reason: '단기 목표 달성',
      emotion: 'PLANNED',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('068270');
    expect(result.side).toBe('SELL');
  });

  // ── 24. KB금융 ───────────────────────────────────────────────────────────

  test('24. KB금융 105560 BUY', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: 'KB금융',
      ticker: '105560',
      quantity: 15,
      quantityUnit: 'SHARES',
      price: 67000,
      useMarketPrice: false,
      reason: '배당 목적',
      emotion: 'PLANNED',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('105560');
    expect(result.reason).toBe('배당 목적');
  });

  // ── 25. MSFT 해외 주식 ───────────────────────────────────────────────────

  test('25. MSFT 해외 주식 ticker 그대로', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '마이크로소프트',
      ticker: 'MSFT',
      quantity: 3,
      quantityUnit: 'SHARES',
      price: 420,
      useMarketPrice: false,
      reason: null,
      emotion: 'TECHNICAL',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('MSFT');
  });

  // ── 26. side만 있고 나머지 없음 ─────────────────────────────────────────

  test('26. side만 있고 종목+수량 없음 → confidence 0', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '',
      ticker: null,
      quantity: null,
      quantityUnit: 'SHARES',
      price: null,
      useMarketPrice: true,
      reason: null,
      emotion: null,
      confidence: 0,
      missingFields: ['stockQuery', 'quantity'],
      clarificationQuestion: '어떤 종목을 몇 주 매수하셨나요?',
    });

    expect(result.confidence).toBe(0);
    expect(result.missingFields).toContain('stockQuery');
    expect(result.missingFields).toContain('quantity');
  });

  // ── 27. LLM이 추가 필드 반환해도 무시 ───────────────────────────────────

  test('27. LLM 응답에 알 수 없는 필드 있어도 정상 파싱', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '두산에너빌리티',
      ticker: '034020',
      quantity: 200,
      quantityUnit: 'SHARES',
      price: 22000,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
      unknownField: '무시할 값',  // 알 수 없는 필드
    });

    expect(result.side).toBe('BUY');
    expect(result.ticker).toBe('034020');
  });

  // ── 28. 대량 주문 ────────────────────────────────────────────────────────

  test('28. 대량 주문 1000주 파싱', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '삼성전자',
      ticker: '005930',
      quantity: 1000,
      quantityUnit: 'SHARES',
      price: 72000,
      useMarketPrice: false,
      reason: '장기 투자',
      emotion: 'PLANNED',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.quantity).toBe(1000);
  });

  // ── 29. reason null ──────────────────────────────────────────────────────

  test('29. reason null이면 undefined로 반환', async () => {
    const result = await parse(svc, {
      side: 'SELL',
      stockQuery: '한국전력',
      ticker: '015760',
      quantity: 50,
      quantityUnit: 'SHARES',
      price: 20000,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.reason).toBeUndefined();
  });

  // ── 30. confidence 범위 경계값 ───────────────────────────────────────────

  test('30. confidence 0.3 (핵심 2개 누락)', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '삼성SDI',
      ticker: '006400',
      quantity: null,
      quantityUnit: 'SHARES',
      price: null,
      useMarketPrice: true,
      reason: null,
      emotion: null,
      confidence: 0.3,
      missingFields: ['quantity'],
      clarificationQuestion: '몇 주 매수하셨나요?',
    });

    expect(result.confidence).toBe(0.3);
  });

  // ── 31. missingFields 빈 배열 → 기본값 ──────────────────────────────────

  test('31. missingFields LLM 응답에 없으면 빈 배열 기본값', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '하이브',
      ticker: '352820',
      quantity: 5,
      quantityUnit: 'SHARES',
      price: 190000,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.9,
      // missingFields 생략
      clarificationQuestion: null,
    });

    expect(result.missingFields).toEqual([]);
  });

  // ── 32. clarificationQuestion null ──────────────────────────────────────

  test('32. clarificationQuestion null이면 undefined 반환', async () => {
    const result = await parse(svc, {
      side: 'SELL',
      stockQuery: '카카오뱅크',
      ticker: '323410',
      quantity: 10,
      quantityUnit: 'SHARES',
      price: 22000,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.clarificationQuestion).toBeUndefined();
  });

  // ── 33. 소수 주식 (ETF 분할매수) ────────────────────────────────────────

  test('33. KODEX 200 ETF 수량 파싱', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: 'KODEX200',
      ticker: '069500',
      quantity: 100,
      quantityUnit: 'SHARES',
      price: 30000,
      useMarketPrice: false,
      reason: '정기 적립',
      emotion: 'PLANNED',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.stockQuery).toBe('KODEX200');
    expect(result.ticker).toBe('069500');
  });

  // ── 34. S&P500 ETF 해외 ─────────────────────────────────────────────────

  test('34. SPY ETF 해외 ticker', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: 'SPY',
      ticker: 'SPY',
      quantity: 2,
      quantityUnit: 'SHARES',
      price: 520,
      useMarketPrice: false,
      reason: '지수 추종',
      emotion: 'PLANNED',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('SPY');
  });

  // ── 35. emotion 없는 경우 ────────────────────────────────────────────────

  test('35. emotion null → undefined 반환', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '삼성전자',
      ticker: '005930',
      quantity: 5,
      quantityUnit: 'SHARES',
      price: 70000,
      useMarketPrice: false,
      reason: null,
      emotion: null,
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.emotion).toBeUndefined();
  });

  // ── 36. Groq API 401 에러 ────────────────────────────────────────────────

  test('36. Groq API 401 인증 에러 → Error throw', async () => {
    mockGroqError(401);
    await expect(svc.parse('테스트')).rejects.toThrow('LLM API error: 401');
  });

  // ── 37. 빈 문자열 응답 → emptyParsed ────────────────────────────────────

  test('37. LLM 빈 문자열 응답 → emptyParsed', async () => {
    mockGroqResponse('');
    const result = await svc.parse('아무 메시지');

    expect(result.side).toBeNull();
    expect(result.confidence).toBe(0);
  });

  // ── 38. 에코프로비엠 신규 종목 ───────────────────────────────────────────

  test('38. 에코프로비엠 SELL 파싱', async () => {
    const result = await parse(svc, {
      side: 'SELL',
      stockQuery: '에코프로비엠',
      ticker: '247540',
      quantity: 10,
      quantityUnit: 'SHARES',
      price: 230000,
      useMarketPrice: false,
      reason: '2차전지 하락 우려',
      emotion: 'NEWS_REACTION',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('247540');
    expect(result.reason).toBe('2차전지 하락 우려');
  });

  // ── 39. 아마존 해외 주식 ─────────────────────────────────────────────────

  test('39. AMZN BUY 해외 주식', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '아마존',
      ticker: 'AMZN',
      quantity: 1,
      quantityUnit: 'SHARES',
      price: 185,
      useMarketPrice: false,
      reason: null,
      emotion: 'PLANNED',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.ticker).toBe('AMZN');
  });

  // ── 40. 복합 케이스: 가격+이유+감정 모두 ────────────────────────────────

  test('40. 복합 필드 모두 포함된 케이스', async () => {
    const result = await parse(svc, {
      side: 'BUY',
      stockQuery: '삼성전자',
      ticker: '005930',
      quantity: 30,
      quantityUnit: 'SHARES',
      price: 71500,
      useMarketPrice: false,
      reason: '실적 발표 전 저점 매수',
      emotion: 'TECHNICAL',
      confidence: 0.9,
      missingFields: [],
      clarificationQuestion: null,
    });

    expect(result.side).toBe('BUY');
    expect(result.quantity).toBe(30);
    expect(result.price).toBe(71500);
    expect(result.reason).toBe('실적 발표 전 저점 매수');
    expect(result.emotion).toBe('TECHNICAL');
    expect(result.confidence).toBe(0.9);
    expect(result.missingFields).toHaveLength(0);
  });
});
