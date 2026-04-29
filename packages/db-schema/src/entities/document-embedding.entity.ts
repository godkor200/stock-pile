import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EmbeddingSource = 'NEWS' | 'FINANCIAL' | 'DISCLOSURE';

@Entity('document_embeddings')
@Index(['ticker'])
@Index(['source'])
export class DocumentEmbeddingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ticker: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar' })
  source: EmbeddingSource;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  // pgvector: vector(768) — nomic-embed-text 차원
  @Column({
    type: 'text',
    name: 'embedding',
    transformer: {
      to: (v: number[] | null) => (v ? `[${v.join(',')}]` : null),
      from: (v: string | null) =>
        v ? v.slice(1, -1).split(',').map(Number) : null,
    },
    nullable: true,
  })
  embedding: number[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
