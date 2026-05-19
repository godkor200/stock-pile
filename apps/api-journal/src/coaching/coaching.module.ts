import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeEntity } from '@stock-pile/db-schema';
import { CoachingController } from './coaching.controller';
import { CoachingService } from './coaching.service';

@Module({
  imports: [TypeOrmModule.forFeature([TradeEntity])],
  controllers: [CoachingController],
  providers: [CoachingService],
})
export class CoachingModule {}
