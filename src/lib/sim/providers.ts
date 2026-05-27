import type { LLMProvider, ApiFormat } from './types';

export interface ProviderPreset {
  label: string;
  baseUrl: string;
  apiFormat: ApiFormat;
  models: string[];
}

export const PROVIDER_PRESETS: Record<LLMProvider, ProviderPreset> = {
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiFormat: 'gemini',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash'],
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    apiFormat: 'openai-compat',
    models: ['deepseek-v4-flash'],
  },
  ollama: { label: 'Ollama (disabled)', baseUrl: '', apiFormat: 'ollama', models: [] },
  openai: { label: 'OpenAI (disabled)', baseUrl: '', apiFormat: 'openai-compat', models: [] },
  anthropic: { label: 'Anthropic (disabled)', baseUrl: '', apiFormat: 'anthropic', models: [] },
  custom: { label: 'Custom (disabled)', baseUrl: '', apiFormat: 'ollama', models: [] },
};
