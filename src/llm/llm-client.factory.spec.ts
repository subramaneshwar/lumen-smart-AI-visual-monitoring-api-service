jest.mock('openai');
jest.mock('@anthropic-ai/sdk');

import { ConfigService } from '@nestjs/config';
import { createLlmClient } from './llm-client.factory';
import { OpenAiLlmClient } from './openai-llm-client';
import { AnthropicLlmClient } from './anthropic-llm-client';

describe('createLlmClient', () => {
  const makeConfig = (values: Record<string, string>): ConfigService =>
    ({ get: (key: string) => values[key] }) as ConfigService;

  it('defaults to OpenAiLlmClient when LLM_PROVIDER is unset', () => {
    const client = createLlmClient(makeConfig({}));
    expect(client).toBeInstanceOf(OpenAiLlmClient);
  });

  it('resolves to OpenAiLlmClient for LLM_PROVIDER=openai', () => {
    const client = createLlmClient(
      makeConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k' }),
    );
    expect(client).toBeInstanceOf(OpenAiLlmClient);
  });

  it('resolves to AnthropicLlmClient for LLM_PROVIDER=anthropic', () => {
    const client = createLlmClient(
      makeConfig({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }),
    );
    expect(client).toBeInstanceOf(AnthropicLlmClient);
  });
});
