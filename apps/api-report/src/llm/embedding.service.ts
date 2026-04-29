import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Ollama nomic-embed-text 로 768차원 임베딩 생성
 * Ollama가 없으면 null 반환 (graceful degradation)
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaUrl: string;
  private readonly embedModel: string;

  constructor(private readonly config: ConfigService) {
    this.ollamaUrl = config.get('OLLAMA_URL', 'http://localhost:11434');
    this.embedModel = config.get('EMBED_MODEL', 'nomic-embed-text');
  }

  /** 텍스트 → 768차원 벡터. 실패 시 null */
  async embed(text: string): Promise<number[] | null> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.embedModel, prompt: text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = (await res.json()) as { embedding: number[] };
      return data.embedding;
    } catch (err) {
      this.logger.warn(`Embedding failed: ${err}`);
      return null;
    }
  }

  /** 여러 텍스트를 순서대로 임베딩 */
  async embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    const results: (number[] | null)[] = [];
    for (const t of texts) {
      results.push(await this.embed(t));
    }
    return results;
  }
}
