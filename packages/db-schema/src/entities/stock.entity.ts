import { Column, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Market } from '@stock-pile/shared-types';
import { TradeEntity } from './trade.entity';
import { PositionEntity } from './position.entity';
import { AnalysisReportEntity } from './analysis-report.entity';

@Entity('stocks')
export class StockEntity {
  @PrimaryColumn()
  ticker: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: Market })
  market: Market;

  @Column({ type: 'varchar', nullable: true })
  sector: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TradeEntity, (trade) => trade.stock)
  trades: TradeEntity[];

  @OneToMany(() => PositionEntity, (position) => position.stock)
  positions: PositionEntity[];

  @OneToMany(() => AnalysisReportEntity, (report) => report.stock)
  analysisReports: AnalysisReportEntity[];
}
