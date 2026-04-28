import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TradeEntity } from './trade.entity';
import { PositionEntity } from './position.entity';
import { AnalysisReportEntity } from './analysis-report.entity';
import { StrategyEntity } from './strategy.entity';
import { ChatSessionEntity } from './chat-session.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', name: 'telegram_user_id', nullable: true, unique: true })
  telegramUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => TradeEntity, (trade) => trade.user)
  trades: TradeEntity[];

  @OneToMany(() => PositionEntity, (position) => position.user)
  positions: PositionEntity[];

  @OneToMany(() => AnalysisReportEntity, (report) => report.user)
  analysisReports: AnalysisReportEntity[];

  @OneToMany(() => StrategyEntity, (strategy) => strategy.user)
  strategies: StrategyEntity[];

  @OneToMany(() => ChatSessionEntity, (session) => session.user)
  chatSessions: ChatSessionEntity[];
}
