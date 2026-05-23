import type { LLMConfig } from '../../../src/lib/sim/types';

export function deepseekConfig(maxConcurrent = 5): LLMConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY env var required for LLM tests');
  return {
    baseUrl: 'https://api.deepseek.com',
    apiKey,
    model: 'deepseek-chat',
    apiFormat: 'openai-compat',
    provider: 'deepseek',
    maxConcurrent,
  };
}

export const TEST_CONFIGS = {
  plan2_10agents: { nAgents: 10, seed: 42 },
  plan2_20agents: { nAgents: 20, seed: 42 },
  plan3_10agents: { nAgents: 10, seed: 99 },
  plan3_20agents: { nAgents: 20, seed: 99 },
  plan2_random1:  { nAgents: 10, seed: 1337 },
  plan2_random2:  { nAgents: 10, seed: 7 },
} as const;
