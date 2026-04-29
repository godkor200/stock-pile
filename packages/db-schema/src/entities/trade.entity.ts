import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Emotion, TradeSide, TradeSource } from '@stock-pile/shared-types';
import { UserEntity } from './user.entity';
import { StockEntity } from './stock.entity';

@Entity('trades')
@Index(['userId', 'tradedAt'])
@Index(['userId', 'ticker'])
export class TradeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  ticker: string;

  @Column({ type: 'enum', enum: TradeSide })
  side: TradeSide;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  price: number;

  @Column({ name: 'traded_at', type: 'timestamptz' })
  tradedAt: Date;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'enum', enum: Emotion, nullable: true })
  emotion: Emotion | null;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'enum', enum: TradeSource })
  source: TradeSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.trades)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => StockEntity, (stock) => stock.trades)
  @JoinColumn({ name: 'ticker' })
  stock: StockEntity;
}
