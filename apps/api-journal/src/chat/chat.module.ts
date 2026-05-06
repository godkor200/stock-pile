import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSessionEntity } from '@stock-pile/db-schema';
import { ChatController } from './chat.controller';
import { ChatInputService } from './chat-input.service';
import { ChatSessionService } from './chat-session.service';
import { ChatAdvisorService } from './chat-advisor.service';
import { ReportClientService } from './report-client.service';
import { StocksModule } from '../stocks/stocks.module';
import { TradesModule } from '../trades/trades.module';
import { UsersModule } from '../users/users.module';
import { PositionsModule } from '../positions/positions.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ChatSessionEntity]),
    StocksModule,
    TradesModule,
    UsersModule,
    PositionsModule,
  ],
  controllers: [ChatController],
  providers: [ChatInputService, ChatSessionService, ChatAdvisorService, ReportClientService],
})
export class ChatModule {}
