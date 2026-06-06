import { Repository } from 'typeorm';
import { VectorStoreService } from './vector-store.service';
import { DocumentEmbeddingEntity } from '@stock-pile/db-schema';
import type { EmbeddingSource } from '@stock-pile/db-schema';
import { EmbeddingService } from '../llm/embedding.service';

function makeDoc(overrides: Partial<DocumentEmbeddingEntity> = {}): DocumentEmbeddingEntity {
  const d = new DocumentEmbeddingEntity();
  d.id = 'doc-uuid-1';
  d.ticker = '005930';
  d.content = '삼성전자 실적 발표';
  d.source = 'DISCLOSURE' as EmbeddingSource;
  d.title = '2026년 1분기 실적';
  d.publishedAt = new Date('2026-04-01');
  d.embedding = null;
  return Object.assign(d, overrides);
}

function buildService(
  repo: Partial<Repository<DocumentEmbeddingEntity>>,
  embeddingService: Partial<EmbeddingService>,
): VectorStoreService {
  return new VectorStoreService(
    repo as unknown as Repository<DocumentEmbeddingEntity>,
    embeddingService as EmbeddingService,
  );
}

describe('VectorStoreService', () => {
  let docRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let embeddingService: { embed: jest.Mock };

  const MOCK_VECTOR = Array.from({ length: 768 }, () => 0.1);

  beforeEach(() => {
    docRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    embeddingService = { embed: jest.fn() };
    jest.clearAllMocks();
  });

  // ── upsert ─────────────────────────────────────────────────────────
  describe('upsert', () => {
    it('동일 ticker+title이 없으면 저장한다', async () => {
      docRepo.findOne.mockResolvedValue(null);
      embeddingService.embed.mockResolvedValue(MOCK_VECTOR);
      const doc = makeDoc();
      docRepo.create.mockReturnValue(doc);
      docRepo.save.mockResolvedValue(doc);
      const recentDate = new Date(Date.now() - 86400 * 1000); // 1일 전 (cutoff 3일 이내)

      await buildService(docRepo, embeddingService).upsert({
        ticker: '005930',
        content: '삼성전자 실적 발표',
        source: 'DISCLOSURE' as EmbeddingSource,
        title: '2026년 1분기 실적',
        publishedAt: recentDate,
      });

      expect(docRepo.save).toHaveBeenCalledTimes(1);
    });

    it('동일 title이 이미 존재하면 저장하지 않는다 (중복 방지)', async () => {
      docRepo.findOne.mockResolvedValue(makeDoc());

      await buildService(docRepo, embeddingService).upsert({
        ticker: '005930',
        content: '중복 내용',
        source: 'DISCLOSURE' as EmbeddingSource,
        title: '2026년 1분기 실적',
      });

      expect(docRepo.save).not.toHaveBeenCalled();
      expect(embeddingService.embed).not.toHaveBeenCalled();
    });

    it('publishedAt이 3일 이상 지난 문서는 저장하지 않는다', async () => {
      docRepo.findOne.mockResolvedValue(null);
      const oldDate = new Date(Date.now() - 4 * 86400 * 1000);

      await buildService(docRepo, embeddingService).upsert({
        ticker: '005930',
        content: '오래된 뉴스',
        source: 'NEWS' as EmbeddingSource,
        title: '오래된 기사',
        publishedAt: oldDate,
      });

      expect(docRepo.save).not.toHaveBeenCalled();
    });

    it('title 없이 저장하면 중복 체크를 건너뛴다', async () => {
      embeddingService.embed.mockResolvedValue(MOCK_VECTOR);
      const doc = makeDoc({ title: null });
      docRepo.create.mockReturnValue(doc);
      docRepo.save.mockResolvedValue(doc);

      await buildService(docRepo, embeddingService).upsert({
        ticker: '005930',
        content: '제목 없는 콘텐츠',
        source: 'FINANCIAL' as EmbeddingSource,
      });

      expect(docRepo.findOne).not.toHaveBeenCalled();
      expect(docRepo.save).toHaveBeenCalledTimes(1);
    });

    it('임베딩 실패해도 null embedding으로 저장한다 (graceful)', async () => {
      docRepo.findOne.mockResolvedValue(null);
      embeddingService.embed.mockResolvedValue(null);
      const doc = makeDoc({ embedding: null });
      docRepo.create.mockReturnValue(doc);
      docRepo.save.mockResolvedValue(doc);

      await buildService(docRepo, embeddingService).upsert({
        ticker: '005930',
        content: '임베딩 실패 케이스',
        source: 'DISCLOSURE' as EmbeddingSource,
      });

      expect(docRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ── search ─────────────────────────────────────────────────────────
  describe('search', () => {
    it('임베딩 성공 → createQueryBuilder로 벡터 유사도 검색', async () => {
      embeddingService.embed.mockResolvedValue(MOCK_VECTOR);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([makeDoc()]),
      };
      docRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await buildService(docRepo, embeddingService).search(
        '삼성전자 실적',
        '005930',
        5,
      );

      expect(result).toHaveLength(1);
      expect(mockQb.orderBy).toHaveBeenCalledWith(expect.stringContaining('<=>'));
    });

    it('임베딩 실패 → recency(최신순) fallback으로 조회', async () => {
      embeddingService.embed.mockResolvedValue(null);
      const docs = [makeDoc(), makeDoc({ id: 'doc-uuid-2' })];
      docRepo.find.mockResolvedValue(docs);

      const result = await buildService(docRepo, embeddingService).search(
        '검색어',
        '005930',
        5,
      );

      expect(docRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ticker: '005930' },
          order: { publishedAt: 'DESC' },
          take: 5,
        }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
