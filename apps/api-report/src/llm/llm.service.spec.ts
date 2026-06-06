import { ConfigService } from '@nestjs/config';
import { LlmService, LlmMessage } from './llm.service';

// Anthropic SDK mock
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

// global fetch mock
const mockFetch = jest.fn();
global.fetch = mockFetch;

function buildConfig(overrides: Record<string, string> = {}): ConfigService {
  const map: Record<string, string> = {
    LLM_PROVIDER: 'anthropic',
    ANTHROPIC_API_KEY: 'test-key',
    GROQ_API_KEY: 'groq-key',
    GROQ_MODEL: 'llama-3.3-70b-versatile',
    OLLAMA_URL: 'http://localhost:11434',
    OLLAMA_MODEL: 'qwen2.5:7b',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, def: unknown) => map[key] ?? def),
  } as unknown as ConfigService;
}

const MESSAGES: LlmMessage[] = [{ role: 'user', content: '안녕하세요' }];

describe('LlmService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── provider 선택 ──────────────────────────────────────────────────
  describe('provider 자동 선택', () => {
    it('LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY 있음 → anthropic 사용', async () => {
      const AnthropicMock = (await import('@anthropic-ai/sdk')).default as unknown as jest.Mock;
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '안녕' }],
        usage: { input_tokens: 5, output_tokens: 3 },
      });
      AnthropicMock.mockImplementation(() => ({ messages: { create: mockCreate } }));

      const service = new LlmService(buildConfig());
      const result = await service.chat('system', MESSAGES);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.text).toBe('안녕');
      expect(result.inputTokens).toBe(5);
      expect(result.outputTokens).toBe(3);
    });

    it('LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY 없음 → Groq로 자동 폴백', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'groq 응답' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      const service = new LlmService(buildConfig({ ANTHROPIC_API_KEY: '' }));
      const result = await service.chat('system', MESSAGES);

      expect(result.text).toBe('groq 응답');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('groq.com'),
        expect.anything(),
      );
    });

    it('LLM_PROVIDER=groq → Groq API 호출', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'groq result' } }],
          usage: { prompt_tokens: 8, completion_tokens: 4 },
        }),
      });

      const service = new LlmService(buildConfig({ LLM_PROVIDER: 'groq' }));
      const result = await service.chat('system', MESSAGES);

      expect(result.text).toBe('groq result');
      expect(result.inputTokens).toBe(8);
      expect(result.outputTokens).toBe(4);
    });

    it('LLM_PROVIDER=ollama → Ollama API 호출', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: { content: 'ollama result' },
          prompt_eval_count: 12,
          eval_count: 6,
        }),
      });

      const service = new LlmService(buildConfig({ LLM_PROVIDER: 'ollama' }));
      const result = await service.chat('system', MESSAGES);

      expect(result.text).toBe('ollama result');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('11434'),
        expect.anything(),
      );
    });
  });

  // ── Groq 에러 처리 ─────────────────────────────────────────────────
  describe('Groq 에러 처리', () => {
    it('GROQ_API_KEY 없으면 Error throw', async () => {
      const service = new LlmService(
        buildConfig({ LLM_PROVIDER: 'groq', GROQ_API_KEY: '' }),
      );
      await expect(service.chat('system', MESSAGES)).rejects.toThrow('GROQ_API_KEY');
    });

    it('Groq HTTP 오류 응답 → Error throw', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'rate limit',
      });

      const service = new LlmService(buildConfig({ LLM_PROVIDER: 'groq' }));
      await expect(service.chat('system', MESSAGES)).rejects.toThrow('Groq error');
    });
  });

  // ── Ollama 에러 처리 ───────────────────────────────────────────────
  describe('Ollama 에러 처리', () => {
    it('Ollama HTTP 오류 응답 → Error throw', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Gateway',
      });

      const service = new LlmService(buildConfig({ LLM_PROVIDER: 'ollama' }));
      await expect(service.chat('system', MESSAGES)).rejects.toThrow('Ollama error');
    });
  });
});
