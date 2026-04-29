import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEmbeddingEntity } from '@stock-pile/db-schema';
import { LlmModule } from '../llm/llm.module';
import { VectorStoreService } from './vector-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentEmbeddingEntity]), LlmModule],
  providers: [VectorStoreService],
  exports: [VectorStoreService],
})
export class VectorModule {}
