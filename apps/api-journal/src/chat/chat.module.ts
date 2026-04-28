import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSessionEntity } from '@stock-pile/db-schema';
import { ChatController } from './chat.controller';
import { ChatInputService } from './chat-input.service';
import { ChatSessionService } from './chat-session.service';
import { StocksModule } from '../stocks/stocks.module';
import { TradesModule } from '../trades/trades.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ChatSessionEntity]),
    StocksModule,
    TradesModule,
  ],
  controllers: [ChatController],
  providers: [ChatInputService, ChatSessionService],
})
export class ChatModule {}
