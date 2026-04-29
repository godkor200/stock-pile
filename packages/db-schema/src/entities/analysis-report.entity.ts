import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Verdict } from '@stock-pile/shared-types';
import { UserEntity } from './user.entity';
import { StockEntity } from './stock.entity';

@Entity('analysis_reports')
@Index(['userId', 'ticker', 'generatedAt'])
export class AnalysisReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  ticker: string;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;

  @Column({ name: 'financial_summary', type: 'jsonb', default: '{}' })
  financialSummary: Record<string, unknown>;

  @Column({ name: 'news_summary', type: 'jsonb', default: '{}' })
  newsSummary: Record<string, unknown>;

  @Column({ name: 'technical_indicators', type: 'jsonb', default: '{}' })
  technicalIndicators: Record<string, unknown>;

  @Column({ name: 'claude_analysis', type: 'text' })
  claudeAnalysis: string;

  @Column({ type: 'enum', enum: Verdict })
  verdict: Verdict;

  @ManyToOne(() => UserEntity, (user) => user.analysisReports)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => StockEntity, (stock) => stock.analysisReports)
  @JoinColumn({ name: 'ticker' })
  stock: StockEntity;
}
