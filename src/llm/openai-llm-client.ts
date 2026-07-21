import OpenAI from 'openai';
import {
  LlmClient,
  LlmGenerateParams,
  LlmGenerationError,
} from './llm-client.interface';

export class OpenAiLlmClient implements LlmClient {
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

  async generate({ system, prompt }: LlmGenerateParams): Promise<string> {
    try {
      const messages = system
        ? [
            { role: 'system' as const, content: system },
            { role: 'user' as const, content: prompt },
          ]
        : [{ role: 'user' as const, content: prompt }];

      const response = await this.getClient().chat.completions.create({
        model: this.model,
        messages,
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      throw new LlmGenerationError('openai', error);
    }
  }
}
