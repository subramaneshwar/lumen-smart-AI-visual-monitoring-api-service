import { ConfigService } from '@nestjs/config';
import { createEmbeddingClient } from './embedding-client.factory';
import { OpenAiEmbeddingClient } from './openai-embedding-client';

describe('createEmbeddingClient', () => {
  const makeConfig = (values: Record<string, string>): ConfigService =>
    ({ get: (key: string) => values[key] }) as ConfigService;

  it('returns an OpenAiEmbeddingClient using OPENAI_API_KEY and OPENAI_EMBEDDING_MODEL', () => {
    const client = createEmbeddingClient(
      makeConfig({
        OPENAI_API_KEY: 'k',
        OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
      }),
    );
    expect(client).toBeInstanceOf(OpenAiEmbeddingClient);
  });

  it('defaults the model to text-embedding-3-small when unset', () => {
    const client = createEmbeddingClient(makeConfig({ OPENAI_API_KEY: 'k' }));
    expect(client).toBeInstanceOf(OpenAiEmbeddingClient);
  });
});
