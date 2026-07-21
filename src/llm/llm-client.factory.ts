import { ConfigService } from '@nestjs/config';
import { LlmClient } from './llm-client.interface';
import { OpenAiLlmClient } from './openai-llm-client';
import { AnthropicLlmClient } from './anthropic-llm-client';

export function createLlmClient(config: ConfigService): LlmClient {
  const provider = config.get<string>('LLM_PROVIDER') ?? 'openai';

  if (provider === 'anthropic') {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY') ?? '';
    const model = config.get<string>('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5';
    return new AnthropicLlmClient(apiKey, model);
  }

  const apiKey = config.get<string>('OPENAI_API_KEY') ?? '';
  const model = config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
  return new OpenAiLlmClient(apiKey, model);
}
