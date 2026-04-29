import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StrategyDsl } from '@stock-pile/shared-types';
import { UserEntity } from './user.entity';
import { BacktestResultEntity } from './backtest-result.entity';

@Entity('strategies')
@Index(['userId'])
export class StrategyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  name: string;

  @Column({ name: 'natural_language', type: 'text' })
  naturalLanguage: string;

  @Column({ name: 'parsed_dsl', type: 'jsonb' })
  parsedDsl: StrategyDsl;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.strategies)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany(() => BacktestResultEntity, (result) => result.strategy)
  backtestResults: BacktestResultEntity[];
}
