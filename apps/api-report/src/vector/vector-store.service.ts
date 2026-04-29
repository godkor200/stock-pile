import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEmbeddingEntity, EmbeddingSource } from '@stock-pile/db-schema';
import { EmbeddingService } from '../llm/embedding.service';

const DEDUP_DAYS = 3;

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(
    @InjectRepository(DocumentEmbeddingEntity)
    private readonly repo: Repository<DocumentEmbeddingEntity>,
    private readonly embedding: EmbeddingService,
  ) {}

  /**
   * 문서를 임베딩해서 저장 (동일 ticker+source+title 중복 방지)
   */
  async upsert(params: {
    ticker: string;
    content: string;
    source: EmbeddingSource;
    title?: string;
    publishedAt?: Date;
  }): Promise<void> {
    if (params.title) {
      const cutoff = new Date(Date.now() - DEDUP_DAYS * 86400 * 1000);
      const exists = await this.repo.findOne({
        where: { ticker: params.ticker, title: params.title },
        select: ['id'],
      });
      if (exists) return;
      if (params.publishedAt && params.publishedAt < cutoff) return;
    }

    const vector = await this.embedding.embed(params.content);

    const doc = this.repo.create({
      ticker: params.ticker,
      content: params.content,
      source: params.source,
      title: params.title ?? null,
      publishedAt: params.publishedAt ?? null,
      embedding: vector,
    });
    await this.repo.save(doc);
  }

  /**
   * 벡터 유사도 검색 — 임베딩이 없으면 최신 문서 fallback
   */
  async search(
    query: string,
    ticker: string,
    topK = 5,
  ): Promise<DocumentEmbeddingEntity[]> {
    const queryVector = await this.embedding.embed(query);

    if (!queryVector) {
      this.logger.warn('Embedding unavailable — falling back to recency sort');
      return this.repo.find({
        where: { ticker },
        order: { publishedAt: 'DESC' },
        take: topK,
      });
    }

    const vectorStr = `[${queryVector.join(',')}]`;
    // pgvector cosine distance (<=>)
    const results = await this.repo
      .createQueryBuilder('d')
      .where('d.ticker = :ticker', { ticker })
      .andWhere('d.embedding IS NOT NULL')
      .orderBy(`d.embedding <=> '${vectorStr}'::vector`)
      .limit(topK)
      .getMany();

    return results;
  }
}
