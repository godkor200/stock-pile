import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { StrategyEntity } from './strategy.entity';

@Entity('backtest_results')
@Index(['userId'])
@Index(['strategyId'])
export class BacktestResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'strategy_id' })
  strategyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: Date;

  @Column({ name: 'initial_capital', type: 'decimal', precision: 18, scale: 2 })
  initialCapital: number;

  @Column({ name: 'final_capital', type: 'decimal', precision: 18, scale: 2 })
  finalCapital: number;

  @Column({ name: 'total_return', type: 'decimal', precision: 10, scale: 4 })
  totalReturn: number;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  mdd: number;

  @Column({ name: 'win_rate', type: 'decimal', precision: 10, scale: 4 })
  winRate: number;

  @Column({ name: 'sharpe_ratio', type: 'decimal', precision: 10, scale: 4 })
  sharpeRatio: number;

  @Column({ name: 'total_trades', default: 0 })
  totalTrades: number;

  @Column({ name: 'trades_log', type: 'jsonb', default: '{}' })
  tradesLog: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => StrategyEntity, (strategy) => strategy.backtestResults)
  @JoinColumn({ name: 'strategy_id' })
  strategy: StrategyEntity;
}
