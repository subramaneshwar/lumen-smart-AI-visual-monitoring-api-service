import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_CLIENT } from './llm-client.interface';
import { createLlmClient } from './llm-client.factory';

@Module({
  providers: [
    {
      provide: LLM_CLIENT,
      inject: [ConfigService],
      useFactory: createLlmClient,
    },
  ],
  exports: [LLM_CLIENT],
})
export class LlmModule {}
