const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

import { OpenAiLlmClient } from './openai-llm-client';
import { LlmGenerationError } from './llm-client.interface';

describe('OpenAiLlmClient', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('sends system + user messages and returns the response text', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Here is your summary.' } }],
    });
    const client = new OpenAiLlmClient('test-key', 'gpt-4o-mini');

    const result = await client.generate({
      system: 'You are a summarizer.',
      prompt: 'Summarize: person detected at 10am.',
    });

    expect(result).toBe('Here is your summary.');
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a summarizer.' },
        {
          role: 'user',
          content: 'Summarize: person detected at 10am.',
        },
      ],
    });
  });

  it('omits the system message when none is provided', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'ok' } }],
    });
    const client = new OpenAiLlmClient('test-key', 'gpt-4o-mini');

    await client.generate({ prompt: 'Summarize: nothing happened.' });

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Summarize: nothing happened.' },
      ],
    });
  });

  it('wraps a provider error in LlmGenerationError', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    const client = new OpenAiLlmClient('test-key', 'gpt-4o-mini');

    await expect(
      client.generate({ prompt: 'Summarize: x' }),
    ).rejects.toThrow(LlmGenerationError);
  });
});
