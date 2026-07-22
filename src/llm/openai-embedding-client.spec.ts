const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: { create: mockCreate },
  }));
});

import OpenAI from 'openai';
import { OpenAiEmbeddingClient } from './openai-embedding-client';
import { EmbeddingGenerationError } from './embedding-client.interface';

describe('OpenAiEmbeddingClient', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    (OpenAI as unknown as jest.Mock).mockClear();
  });

  it('embeds text with the configured model and 384 dimensions', async () => {
    mockCreate.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    const client = new OpenAiEmbeddingClient(
      'test-key',
      'text-embedding-3-small',
    );

    const result = await client.embed(
      'person detected in front_door at 10:15:00 AM',
    );

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'person detected in front_door at 10:15:00 AM',
      dimensions: 384,
    });
  });

  it('does not construct the OpenAI SDK client until embed() is called', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const client = new OpenAiEmbeddingClient('test-key', 'text-embedding-3-small');
    expect(OpenAI).not.toHaveBeenCalled();
  });

  it('wraps a provider error in EmbeddingGenerationError', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    const client = new OpenAiEmbeddingClient(
      'test-key',
      'text-embedding-3-small',
    );

    await expect(client.embed('x')).rejects.toThrow(EmbeddingGenerationError);
  });
});
