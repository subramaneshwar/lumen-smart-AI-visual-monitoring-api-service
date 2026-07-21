import Anthropic from '@anthropic-ai/sdk';
import {
  LlmClient,
  LlmGenerateParams,
  LlmGenerationError,
} from './llm-client.interface';

export class AnthropicLlmClient implements LlmClient {
  private client: Anthropic | undefined;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async generate({ system, prompt }: LlmGenerateParams): Promise<string> {
    try {
      const response = await this.getClient().messages.create({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(
        (block) => block.type === 'text',
      );
      return textBlock && textBlock.type === 'text' ? textBlock.text : '';
    } catch (error) {
      throw new LlmGenerationError('anthropic', error);
    }
  }
}
