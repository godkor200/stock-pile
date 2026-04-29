import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { StockEntity } from './stock.entity';

@Entity('positions')
@Index(['userId', 'ticker'], { unique: true })
export class PositionEntity {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @PrimaryColumn()
  ticker: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  quantity: number;

  @Column({ name: 'avg_price', type: 'decimal', precision: 18, scale: 2, default: 0 })
  avgPrice: number;

  @Column({ name: 'realized_pnl', type: 'decimal', precision: 18, scale: 2, default: 0 })
  realizedPnl: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.positions)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => StockEntity, (stock) => stock.positions)
  @JoinColumn({ name: 'ticker' })
  stock: StockEntity;
}
