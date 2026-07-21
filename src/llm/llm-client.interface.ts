export const LLM_CLIENT = 'LLM_CLIENT';

export interface LlmGenerateParams {
  system?: string;
  prompt: string;
}

export interface LlmClient {
  generate(params: LlmGenerateParams): Promise<string>;
}

export class LlmGenerationError extends Error {
  constructor(provider: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`LLM generation failed (${provider}): ${message}`);
    this.name = 'LlmGenerationError';
  }
}
