import OpenAI from 'openai';
import {
  LlmClient,
  LlmGenerateParams,
  LlmGenerationError,
} from './llm-client.interface';

export class OpenAiLlmClient implements LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generate({ system, prompt }: LlmGenerateParams): Promise<string> {
    try {
      const messages = system
        ? [
            { role: 'system' as const, content: system },
            { role: 'user' as const, content: prompt },
          ]
        : [{ role: 'user' as const, content: prompt }];

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      throw new LlmGenerationError('openai', error);
    }
  }
}
