import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1714200000000 implements MigrationInterface {
  name = 'InitialSchema1714200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."market_enum" AS ENUM('KOSPI', 'KOSDAQ', 'NASDAQ', 'NYSE')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."trade_side_enum" AS ENUM('BUY', 'SELL')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."emotion_enum" AS ENUM(
        'PLANNED', 'IMPULSIVE', 'NEWS_REACTION', 'TECHNICAL', 'FOMO'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."trade_source_enum" AS ENUM('CHATBOT', 'CSV_IMPORT', 'MANUAL_EDIT')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."verdict_enum" AS ENUM('BUY', 'HOLD', 'SELL', 'NEUTRAL')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."chat_session_status_enum" AS ENUM(
        'PENDING', 'AMBIGUOUS', 'READY', 'CONFIRMED', 'EXPIRED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "telegram_user_id" varchar UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "stocks" (
        "ticker" varchar PRIMARY KEY,
        "name" varchar NOT NULL,
        "market" "public"."market_enum" NOT NULL,
        "sector" varchar,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "trades" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "ticker" varchar NOT NULL REFERENCES stocks(ticker),
        "side" "public"."trade_side_enum" NOT NULL,
        "quantity" decimal(18,8) NOT NULL,
        "price" decimal(18,2) NOT NULL,
        "traded_at" timestamptz NOT NULL,
        "reason" text,
        "emotion" "public"."emotion_enum",
        "tags" text[] NOT NULL DEFAULT '{}',
        "source" "public"."trade_source_enum" NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_user_traded_at" ON "trades" ("user_id", "traded_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_trades_user_ticker" ON "trades" ("user_id", "ticker")
    `);

    await queryRunner.query(`
      CREATE TABLE "positions" (
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "ticker" varchar NOT NULL REFERENCES stocks(ticker),
        "quantity" decimal(18,8) NOT NULL DEFAULT 0,
        "avg_price" decimal(18,2) NOT NULL DEFAULT 0,
        "realized_pnl" decimal(18,2) NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id", "ticker")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "analysis_reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "ticker" varchar NOT NULL REFERENCES stocks(ticker),
        "generated_at" timestamptz NOT NULL DEFAULT now(),
        "financial_summary" jsonb NOT NULL DEFAULT '{}',
        "news_summary" jsonb NOT NULL DEFAULT '{}',
        "technical_indicators" jsonb NOT NULL DEFAULT '{}',
        "claude_analysis" text NOT NULL,
        "verdict" "public"."verdict_enum" NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reports_user_ticker_generated" ON "analysis_reports"
        ("user_id", "ticker", "generated_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "strategies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "natural_language" text NOT NULL,
        "parsed_dsl" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_strategies_user" ON "strategies" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "backtest_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "strategy_id" uuid NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "initial_capital" decimal(18,2) NOT NULL,
        "final_capital" decimal(18,2) NOT NULL,
        "total_return" decimal(10,4) NOT NULL,
        "mdd" decimal(10,4) NOT NULL,
        "win_rate" decimal(10,4) NOT NULL,
        "sharpe_ratio" decimal(10,4) NOT NULL,
        "total_trades" integer NOT NULL DEFAULT 0,
        "trades_log" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_backtest_user" ON "backtest_results" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_backtest_strategy" ON "backtest_results" ("strategy_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_sessions" (
        "session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "parsed_data" jsonb NOT NULL DEFAULT '{}',
        "missing_fields" text[] NOT NULL DEFAULT '{}',
        "status" "public"."chat_session_status_enum" NOT NULL DEFAULT 'PENDING',
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_chat_sessions_user" ON "chat_sessions" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "chat_sessions"`);
    await queryRunner.query(`DROP TABLE "backtest_results"`);
    await queryRunner.query(`DROP TABLE "strategies"`);
    await queryRunner.query(`DROP TABLE "analysis_reports"`);
    await queryRunner.query(`DROP TABLE "positions"`);
    await queryRunner.query(`DROP TABLE "trades"`);
    await queryRunner.query(`DROP TABLE "stocks"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."chat_session_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."verdict_enum"`);
    await queryRunner.query(`DROP TYPE "public"."trade_source_enum"`);
    await queryRunner.query(`DROP TYPE "public"."emotion_enum"`);
    await queryRunner.query(`DROP TYPE "public"."trade_side_enum"`);
    await queryRunner.query(`DROP TYPE "public"."market_enum"`);
  }
}
