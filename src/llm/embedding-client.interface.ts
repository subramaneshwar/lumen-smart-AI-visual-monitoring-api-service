export const EMBEDDING_CLIENT = 'EMBEDDING_CLIENT';

export interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
}

export class EmbeddingGenerationError extends Error {
  constructor(provider: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Embedding generation failed (${provider}): ${message}`);
    this.name = 'EmbeddingGenerationError';
  }
}
