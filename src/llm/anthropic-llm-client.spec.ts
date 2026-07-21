const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

import { AnthropicLlmClient } from './anthropic-llm-client';
import { LlmGenerationError } from './llm-client.interface';

describe('AnthropicLlmClient', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('sends system + user content and returns the response text', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Here is your summary.' }],
    });
    const client = new AnthropicLlmClient('test-key', 'claude-haiku-4-5');

    const result = await client.generate({
      system: 'You are a summarizer.',
      prompt: 'Summarize: person detected at 10am.',
    });

    expect(result).toBe('Here is your summary.');
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: 'You are a summarizer.',
      messages: [
        { role: 'user', content: 'Summarize: person detected at 10am.' },
      ],
    });
  });

  it('returns an empty string when no text block is present', async () => {
    mockCreate.mockResolvedValue({ content: [] });
    const client = new AnthropicLlmClient('test-key', 'claude-haiku-4-5');

    const result = await client.generate({ prompt: 'Summarize: x' });

    expect(result).toBe('');
  });

  it('wraps a provider error in LlmGenerationError', async () => {
    mockCreate.mockRejectedValue(new Error('overloaded'));
    const client = new AnthropicLlmClient('test-key', 'claude-haiku-4-5');

    await expect(
      client.generate({ prompt: 'Summarize: x' }),
    ).rejects.toThrow(LlmGenerationError);
  });
});
