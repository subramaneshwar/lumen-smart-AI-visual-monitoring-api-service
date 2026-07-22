import OpenAI from 'openai';
import {
  EmbeddingClient,
  EmbeddingGenerationError,
} from './embedding-client.interface';

const EMBEDDING_DIMENSIONS = 384;

export class OpenAiEmbeddingClient implements EmbeddingClient {
  private client: OpenAI | undefined;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.getClient().embeddings.create({
        model: this.model,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS,
      });
      return response.data[0]?.embedding ?? [];
    } catch (error) {
      throw new EmbeddingGenerationError('openai', error);
    }
  }
}
