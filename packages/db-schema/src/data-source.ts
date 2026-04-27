import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { StockEntity } from './entities/stock.entity';
import { TradeEntity } from './entities/trade.entity';
import { PositionEntity } from './entities/position.entity';
import { AnalysisReportEntity } from './entities/analysis-report.entity';
import { StrategyEntity } from './entities/strategy.entity';
import { BacktestResultEntity } from './entities/backtest-result.entity';
import { ChatSessionEntity } from './entities/chat-session.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? 'stockpile',
  username: process.env.POSTGRES_USER ?? 'stockpile',
  password: process.env.POSTGRES_PASSWORD ?? 'stockpile',
  entities: [
    UserEntity,
    StockEntity,
    TradeEntity,
    PositionEntity,
    AnalysisReportEntity,
    StrategyEntity,
    BacktestResultEntity,
    ChatSessionEntity,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
