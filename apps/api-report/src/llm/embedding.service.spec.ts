import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function buildConfig(overrides: Record<string, string> = {}): ConfigService {
  const map: Record<string, string> = {
    OLLAMA_URL: 'http://localhost:11434',
    EMBED_MODEL: 'nomic-embed-text',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, def: unknown) => map[key] ?? def),
  } as unknown as ConfigService;
}

function buildService(overrides: Record<string, string> = {}): EmbeddingService {
  return new EmbeddingService(buildConfig(overrides));
}

const MOCK_VECTOR = Array.from({ length: 768 }, (_, i) => i * 0.001);

describe('EmbeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── embed ─────────────────────────────────────────────────────────
  describe('embed', () => {
    it('Ollama 성공 → 벡터 배열 반환', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: MOCK_VECTOR }),
      });

      const result = await buildService().embed('삼성전자 실적');

      expect(result).toEqual(MOCK_VECTOR);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('Ollama HTTP 오류 → null 반환 (graceful degradation)', async () => {
      mockFetch.mockResolvedValue({ ok: false, statusText: 'Service Unavailable' });

      const result = await buildService().embed('test');

      expect(result).toBeNull();
    });

    it('fetch 네트워크 오류 → null 반환', async () => {
      mockFetch.mockRejectedValue(new Error('connection refused'));

      const result = await buildService().embed('test');

      expect(result).toBeNull();
    });

    it('요청 바디에 model과 prompt가 포함된다', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: MOCK_VECTOR }),
      });

      await buildService({ EMBED_MODEL: 'custom-model' }).embed('쿼리 텍스트');

      const callArg = mockFetch.mock.calls[0][1] as { body: string };
      const body = JSON.parse(callArg.body) as { model: string; prompt: string };
      expect(body.model).toBe('custom-model');
      expect(body.prompt).toBe('쿼리 텍스트');
    });
  });

  // ── embedBatch ────────────────────────────────────────────────────
  describe('embedBatch', () => {
    it('여러 텍스트를 순서대로 임베딩한다', async () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: vec1 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: vec2 }) });

      const result = await buildService().embedBatch(['텍스트1', '텍스트2']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(vec1);
      expect(result[1]).toEqual(vec2);
    });

    it('일부 실패해도 null이 포함된 배열 반환 (전체 실패 안 함)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [1, 2] }) })
        .mockRejectedValueOnce(new Error('timeout'));

      const result = await buildService().embedBatch(['성공', '실패']);

      expect(result[0]).toEqual([1, 2]);
      expect(result[1]).toBeNull();
    });

    it('빈 배열 입력 → 빈 배열 반환', async () => {
      const result = await buildService().embedBatch([]);
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
