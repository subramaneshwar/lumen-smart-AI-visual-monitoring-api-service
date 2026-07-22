import { ConfigService } from '@nestjs/config';
import { EmbeddingClient } from './embedding-client.interface';
import { OpenAiEmbeddingClient } from './openai-embedding-client';

export function createEmbeddingClient(
  config: ConfigService,
): EmbeddingClient {
  const apiKey = config.get<string>('OPENAI_API_KEY') ?? '';
  const model =
    config.get<string>('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
  return new OpenAiEmbeddingClient(apiKey, model);
}
