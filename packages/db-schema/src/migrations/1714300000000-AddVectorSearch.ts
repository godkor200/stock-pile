import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVectorSearch1714300000000 implements MigrationInterface {
  name = 'AddVectorSearch1714300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // pgvector 확장 활성화
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TABLE "document_embeddings" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ticker"       varchar NOT NULL,
        "content"      text NOT NULL,
        "source"       varchar NOT NULL,
        "title"        varchar,
        "published_at" timestamptz,
        "embedding"    vector(768),
        "created_at"   timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_doc_emb_ticker" ON "document_embeddings" ("ticker")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_doc_emb_source" ON "document_embeddings" ("source")`,
    );
    // HNSW 인덱스 — 근사 최근접 이웃 탐색
    await queryRunner.query(`
      CREATE INDEX "IDX_doc_emb_vector"
        ON "document_embeddings"
        USING hnsw ("embedding" vector_cosine_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "document_embeddings"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
