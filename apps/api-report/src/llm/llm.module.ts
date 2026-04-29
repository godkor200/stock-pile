import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './llm.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [ConfigModule],
  providers: [LlmService, EmbeddingService],
  exports: [LlmService, EmbeddingService],
})
export class LlmModule {}
