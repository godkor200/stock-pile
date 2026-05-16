import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatAdvisorService } from './chat-advisor.service';

// ── fetch mock ─────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockGroqIntent(intent: string, ticker: string | null) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ intent, ticker }) } }],
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

function mockGroqRawText(text: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: text } }],
    }),
  });
}

// ── 서비스 팩토리 ───────────────────────────────────────────────────────────

import { PositionsService } from '../positions/positions.service';
import { TradesService } from '../trades/trades.service';
import { StocksService } from '../stocks/stocks.service';
import { ReportClientService } from './report-client.service';

async function buildServiceFull(): Promise<ChatAdvisorService> {
  const module = await Test.createTestingModule({
    providers: [
      ChatAdvisorService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, def?: unknown) => {
            const cfg: Record<string, string> = {
              GROQ_MODEL: 'llama-3.1-8b-instant',
              GROQ_API_KEY: 'test-key',
              ANTHROPIC_API_KEY: '',
            };
            return cfg[key] ?? def;
          },
        },
      },
      { provide: PositionsService, useValue: {} },
      { provide: TradesService, useValue: {} },
      { provide: StocksService, useValue: {} },
      { provide: ReportClientService, useValue: {} },
    ],
  }).compile();

  return module.get(ChatAdvisorService);
}

// ── 테스트 스위트 ────────────────────────────────────────────────────────────

describe('ChatAdvisorService.classify() — 의도 분류', () => {
  let svc: ChatAdvisorService;

  beforeAll(async () => {
    svc = await buildServiceFull();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  // ── TRADE_ENTRY 케이스 ─────────────────────────────────────────────────

  test('1. "삼성전자 10주 매수" → TRADE_ENTRY, 005930', async () => {
    mockGroqIntent('TRADE_ENTRY', '005930');
    const result = await svc.classify('삼성전자 10주 매수');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('005930');
  });

  test('2. "어제 카카오 팔았어" → TRADE_ENTRY, 035720', async () => {
    mockGroqIntent('TRADE_ENTRY', '035720');
    const result = await svc.classify('어제 카카오 팔았어');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('035720');
  });

  test('3. "LG전자 5주 68000원에 샀어" → TRADE_ENTRY, 066570', async () => {
    mockGroqIntent('TRADE_ENTRY', '066570');
    const result = await svc.classify('LG전자 5주 68000원에 샀어');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('066570');
  });

  test('4. "방금 애플 3주 샀다" → TRADE_ENTRY, AAPL', async () => {
    mockGroqIntent('TRADE_ENTRY', 'AAPL');
    const result = await svc.classify('방금 애플 3주 샀다');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('AAPL');
  });

  test('5. "삼전우 1300원에 100주 샀어" → TRADE_ENTRY, 005935', async () => {
    mockGroqIntent('TRADE_ENTRY', '005935');
    const result = await svc.classify('삼전우 1300원에 100주 샀어');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('005935');
  });

  test('6. "NVDA 5주 매도" → TRADE_ENTRY, NVDA', async () => {
    mockGroqIntent('TRADE_ENTRY', 'NVDA');
    const result = await svc.classify('NVDA 5주 매도');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('NVDA');
  });

  test('7. "SK하이닉스 20주 138000원에 매수" → TRADE_ENTRY, 000660', async () => {
    mockGroqIntent('TRADE_ENTRY', '000660');
    const result = await svc.classify('SK하이닉스 20주 138000원에 매수');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('000660');
  });

  test('8. "TSLA 2주 팔았어" → TRADE_ENTRY, TSLA', async () => {
    mockGroqIntent('TRADE_ENTRY', 'TSLA');
    const result = await svc.classify('TSLA 2주 팔았어');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('TSLA');
  });

  test('9. "현대차 10주 85000원에 샀어" → TRADE_ENTRY, 005380', async () => {
    mockGroqIntent('TRADE_ENTRY', '005380');
    const result = await svc.classify('현대차 10주 85000원에 샀어');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('005380');
  });

  test('10. "기아 50주 시장가 매수" → TRADE_ENTRY, 000270', async () => {
    mockGroqIntent('TRADE_ENTRY', '000270');
    const result = await svc.classify('기아 50주 시장가 매수');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('000270');
  });

  // ── INVESTMENT_QUERY 케이스 ────────────────────────────────────────────

  test('11. "삼성전자 지금 사도 돼?" → INVESTMENT_QUERY, 005930', async () => {
    mockGroqIntent('INVESTMENT_QUERY', '005930');
    const result = await svc.classify('삼성전자 지금 사도 돼?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('005930');
  });

  test('12. "삼성전자 사야" → INVESTMENT_QUERY, 005930', async () => {
    mockGroqIntent('INVESTMENT_QUERY', '005930');
    const result = await svc.classify('삼성전자 사야');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('005930');
  });

  test('13. "카카오 어때?" → INVESTMENT_QUERY, 035720', async () => {
    mockGroqIntent('INVESTMENT_QUERY', '035720');
    const result = await svc.classify('카카오 어때?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('035720');
  });

  test('14. "내 포트폴리오 어때?" → INVESTMENT_QUERY, null', async () => {
    mockGroqIntent('INVESTMENT_QUERY', null);
    const result = await svc.classify('내 포트폴리오 어때?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  test('15. "안녕" → INVESTMENT_QUERY, null', async () => {
    mockGroqIntent('INVESTMENT_QUERY', null);
    const result = await svc.classify('안녕');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  test('16. "요즘 반도체 전망은?" → INVESTMENT_QUERY, null', async () => {
    mockGroqIntent('INVESTMENT_QUERY', null);
    const result = await svc.classify('요즘 반도체 전망은?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  test('17. "손실 종목 뭐야?" → INVESTMENT_QUERY, null', async () => {
    mockGroqIntent('INVESTMENT_QUERY', null);
    const result = await svc.classify('손실 종목 뭐야?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  test('18. "SK하이닉스 살까" → INVESTMENT_QUERY, 000660', async () => {
    mockGroqIntent('INVESTMENT_QUERY', '000660');
    const result = await svc.classify('SK하이닉스 살까');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('000660');
  });

  test('19. "삼성전자 괜찮아?" → INVESTMENT_QUERY, 005930', async () => {
    mockGroqIntent('INVESTMENT_QUERY', '005930');
    const result = await svc.classify('삼성전자 괜찮아?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('005930');
  });

  test('20. "오늘 시장 어때?" → INVESTMENT_QUERY, null', async () => {
    mockGroqIntent('INVESTMENT_QUERY', null);
    const result = await svc.classify('오늘 시장 어때?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  test('21. "AAPL 지금 들어가도 돼?" → INVESTMENT_QUERY, AAPL', async () => {
    mockGroqIntent('INVESTMENT_QUERY', 'AAPL');
    const result = await svc.classify('AAPL 지금 들어가도 돼?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('AAPL');
  });

  test('22. "내 수익률은?" → INVESTMENT_QUERY, null', async () => {
    mockGroqIntent('INVESTMENT_QUERY', null);
    const result = await svc.classify('내 수익률은?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  test('23. "2차전지 전망 알려줘" → INVESTMENT_QUERY, null', async () => {
    mockGroqIntent('INVESTMENT_QUERY', null);
    const result = await svc.classify('2차전지 전망 알려줘');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  test('24. "NVDA 지금 비싸?" → INVESTMENT_QUERY, NVDA', async () => {
    mockGroqIntent('INVESTMENT_QUERY', 'NVDA');
    const result = await svc.classify('NVDA 지금 비싸?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('NVDA');
  });

  // ── Fallback / 에러 케이스 ─────────────────────────────────────────────

  test('25. Groq API 에러 → TRADE_ENTRY 폴백, ticker null', async () => {
    mockGroqError(500);
    const result = await svc.classify('삼성전자 10주 매수');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBeNull();
  });

  test('26. Groq API 401 에러 → TRADE_ENTRY 폴백', async () => {
    mockGroqError(401);
    const result = await svc.classify('아무 메시지');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBeNull();
  });

  test('27. JSON 없는 응답 → TRADE_ENTRY 폴백', async () => {
    mockGroqRawText('이해하지 못했습니다.');
    const result = await svc.classify('불명확한 메시지');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBeNull();
  });

  test('28. 깨진 JSON 응답 → TRADE_ENTRY 폴백', async () => {
    mockGroqRawText('{ intent: TRADE_ENTRY ');
    const result = await svc.classify('테스트');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBeNull();
  });

  test('29. 알 수 없는 intent 값 → TRADE_ENTRY 폴백', async () => {
    mockGroqRawText(JSON.stringify({ intent: 'UNKNOWN_INTENT', ticker: null }));
    const result = await svc.classify('알 수 없는 메시지');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBeNull();
  });

  test('30. ticker 필드 없는 응답 → ticker null', async () => {
    mockGroqRawText(JSON.stringify({ intent: 'INVESTMENT_QUERY' }));
    const result = await svc.classify('일반 질문');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  // ── 경계 케이스 ────────────────────────────────────────────────────────

  test('31. TRADE_ENTRY인데 ticker null → ticker null 반환', async () => {
    mockGroqIntent('TRADE_ENTRY', null);
    const result = await svc.classify('주식 샀어');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBeNull();
  });

  test('32. 빈 문자열 응답 → TRADE_ENTRY 폴백', async () => {
    mockGroqRawText('');
    const result = await svc.classify('아무거나');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBeNull();
  });

  test('33. "포스코홀딩스 사야지" → INVESTMENT_QUERY, 005490', async () => {
    mockGroqIntent('INVESTMENT_QUERY', '005490');
    const result = await svc.classify('포스코홀딩스 사야지');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('005490');
  });

  test('34. "셀트리온 3주 195000원에 매도했어" → TRADE_ENTRY, 068270', async () => {
    mockGroqIntent('TRADE_ENTRY', '068270');
    const result = await svc.classify('셀트리온 3주 195000원에 매도했어');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('068270');
  });

  test('35. "KB금융 어때요?" → INVESTMENT_QUERY, 105560', async () => {
    mockGroqIntent('INVESTMENT_QUERY', '105560');
    const result = await svc.classify('KB금융 어때요?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('105560');
  });

  test('36. "배당주 추천해줘" → INVESTMENT_QUERY, null', async () => {
    mockGroqIntent('INVESTMENT_QUERY', null);
    const result = await svc.classify('배당주 추천해줘');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  test('37. "어제 MSFT 1주 420달러에 샀어" → TRADE_ENTRY, MSFT', async () => {
    mockGroqIntent('TRADE_ENTRY', 'MSFT');
    const result = await svc.classify('어제 MSFT 1주 420달러에 샀어');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('MSFT');
  });

  test('38. "AI 관련주 어때?" → INVESTMENT_QUERY, null', async () => {
    mockGroqIntent('INVESTMENT_QUERY', null);
    const result = await svc.classify('AI 관련주 어때?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBeNull();
  });

  test('39. "AMZN 1주 185달러에 샀다" → TRADE_ENTRY, AMZN', async () => {
    mockGroqIntent('TRADE_ENTRY', 'AMZN');
    const result = await svc.classify('AMZN 1주 185달러에 샀다');
    expect(result.intent).toBe('TRADE_ENTRY');
    expect(result.ticker).toBe('AMZN');
  });

  test('40. "하이브 지금 고점이야?" → INVESTMENT_QUERY, 352820', async () => {
    mockGroqIntent('INVESTMENT_QUERY', '352820');
    const result = await svc.classify('하이브 지금 고점이야?');
    expect(result.intent).toBe('INVESTMENT_QUERY');
    expect(result.ticker).toBe('352820');
  });
});
