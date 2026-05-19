import type { LLMProvider, ApiFormat } from './types';

export interface ProviderPreset {
  label: string;
  baseUrl: string;
  apiFormat: ApiFormat;
  models: string[];
}

export const PROVIDER_PRESETS: Record<LLMProvider, ProviderPreset> = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    apiFormat: 'openai-compat',
    models: ['deepseek-v4-flash'],
  },
  ollama: {
    label: 'Ollama',
    baseUrl: '/ollama',
    apiFormat: 'ollama',
    models: ['gemini-3-flash-preview', 'deepseek-v4-flash:cloud'],
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    apiFormat: 'openai-compat',
    models: ['gpt-4o', 'gpt-4o-mini'],
  },
  anthropic: {
    label: 'Anthropic',
    baseUrl: '/anthropic',
    apiFormat: 'anthropic',
    models: ['claude-sonnet-4-5-20250514'],
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiFormat: 'gemini',
    models: ['gemini-2.5-flash'],
  },
  custom: {
    label: 'Custom',
    baseUrl: '',
    apiFormat: 'ollama',
    models: [],
  },
};
