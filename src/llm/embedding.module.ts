import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMBEDDING_CLIENT } from './embedding-client.interface';
import { createEmbeddingClient } from './embedding-client.factory';

@Module({
  providers: [
    {
      provide: EMBEDDING_CLIENT,
      inject: [ConfigService],
      useFactory: createEmbeddingClient,
    },
  ],
  exports: [EMBEDDING_CLIENT],
})
export class EmbeddingModule {}
