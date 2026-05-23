import type { Page } from '@playwright/test';
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

/** Navigate the 4-step setup wizard and launch an LLM experiment. */
export async function setupLLMPlan(page: Page, plan: 'II' | 'III', apiKey: string) {
  await page.goto('/simulator');

  // Step 1: open wizard, pick plan
  await page.getByRole('button', { name: /^setup$/i }).click();
  await page.getByRole('button', { name: new RegExp(`plan.?${plan === 'II' ? 'ii' : 'iii'}`, 'i') }).first().click();
  await page.getByRole('button', { name: /next/i }).click();

  // Step 2: asset config — advance without changes
  await page.getByRole('button', { name: /next/i }).click();

  // Step 3: LLM config — inputs have no for= labels, matched by placeholder
  await page.getByPlaceholder('/ollama').fill('https://api.deepseek.com');
  await page.getByPlaceholder('llama3').fill('deepseek-chat');
  await page.getByPlaceholder('Enter API key').fill(apiKey);
  await page.getByRole('button', { name: /next/i }).click();

  // Step 4: review — Run Experiment starts sim and closes modal
  await page.getByRole('button', { name: /run experiment/i }).click();
}
