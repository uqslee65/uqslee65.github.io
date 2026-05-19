import { useState, useEffect } from 'react';
import { useSimulator } from '../SimulatorProvider';
import { testConnection } from '../../../lib/sim/llm-client';
import { PROVIDER_PRESETS } from '../../../lib/sim/providers';
import type { LLMProvider, ApiFormat } from '../../../lib/sim/types';

const PROVIDERS: { id: LLMProvider; label: string }[] = [
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'ollama', label: 'Ollama' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'custom', label: 'Custom' },
];

const API_FORMATS: { value: ApiFormat; label: string }[] = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai-compat', label: 'OpenAI-compat' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
];

function loadApiKey(provider: LLMProvider): string {
  try {
    return localStorage.getItem('sim-apikey-' + provider) ?? '';
  } catch { return ''; }
}

function saveApiKey(provider: LLMProvider, key: string) {
  try {
    localStorage.setItem('sim-apikey-' + provider, key);
  } catch { /* ignore in SSR or private browsing */ }
}

const inputStyle: React.CSSProperties = {
  height: '2rem',
  padding: '0 0.5rem',
  background: 'var(--stat-bg)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--fg)',
  fontSize: '0.75rem',
  width: '100%',
  boxSizing: 'border-box',
};

export function AIEndpoint() {
  const { config, setConfig } = useSimulator();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [showKey, setShowKey] = useState(false);

  if (config.plan === 'plan-i') {
    return (
      <p style={{ fontSize: '0.8rem', color: 'var(--fg-3)', margin: 0 }}>
        Plan I uses algorithmic agents — no API configuration needed.
      </p>
    );
  }

  const llm = config.llm ?? {
    baseUrl: '/ollama',
    apiKey: '',
    model: 'gemini-3-flash-preview',
    maxConcurrent: 3,
    provider: 'ollama' as LLMProvider,
    apiFormat: 'ollama' as ApiFormat,
  };

  const provider: LLMProvider = llm.provider ?? 'ollama';
  const preset = PROVIDER_PRESETS[provider];

  const update = (patch: Partial<typeof llm>) =>
    setConfig({ llm: { ...llm, ...patch } });

  // Load API key from localStorage when provider changes
  useEffect(() => {
    const savedKey = loadApiKey(provider);
    const newPreset = PROVIDER_PRESETS[provider];
    update({
      provider,
      baseUrl: newPreset.baseUrl,
      apiFormat: newPreset.apiFormat,
      model: newPreset.models[0] ?? '',
      apiKey: savedKey,
    });
    setTestResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const handleProviderClick = (p: LLMProvider) => {
    if (p === provider) return;
    const savedKey = loadApiKey(p);
    const newPreset = PROVIDER_PRESETS[p];
    update({
      provider: p,
      baseUrl: newPreset.baseUrl,
      apiFormat: newPreset.apiFormat,
      model: newPreset.models[0] ?? '',
      apiKey: savedKey,
    });
    setTestResult(null);
  };

  const handleApiKeyChange = (key: string) => {
    saveApiKey(provider, key);
    update({ apiKey: key });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await testConnection(llm);
    setTestResult(ok);
    setTesting(false);
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    color: 'var(--fg-3)',
    marginBottom: '0.25rem',
    display: 'block',
  };
  const groupStyle: React.CSSProperties = { marginBottom: '0.75rem' };

  const btnBase: React.CSSProperties = {
    padding: '0.3rem 0',
    borderRadius: '6px',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'border-color 0.15s, background 0.15s',
  };

  const activeBtn: React.CSSProperties = {
    ...btnBase,
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))',
    border: '1.5px solid var(--accent)',
    color: 'var(--accent)',
  };

  const inactiveBtn: React.CSSProperties = {
    ...btnBase,
    background: 'var(--stat-bg)',
    border: '1px solid var(--border)',
    color: 'var(--fg-3)',
  };

  const isOllama = provider === 'ollama';
  const isCustom = provider === 'custom';
  const hasModels = !isCustom && preset.models.length > 0;

  return (
    <div>
      {/* Provider grid */}
      <div style={groupStyle}>
        <label style={labelStyle}>Provider</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
          {PROVIDERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleProviderClick(id)}
              style={id === provider ? activeBtn : inactiveBtn}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Model selection */}
      <div style={groupStyle}>
        <label style={labelStyle}>Model</label>
        {hasModels ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {preset.models.map(m => (
              <button
                key={m}
                onClick={() => update({ model: m })}
                style={{
                  ...btnBase,
                  padding: '0.25rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.68rem',
                  ...(llm.model === m ? {
                    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))',
                    border: '1.5px solid var(--accent)',
                    color: 'var(--accent)',
                  } : {
                    background: 'var(--stat-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg-3)',
                  }),
                }}
              >
                {m}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="text"
            value={llm.model}
            onChange={e => update({ model: e.target.value })}
            placeholder="e.g. llama3, gpt-4o-mini"
            style={inputStyle}
          />
        )}
      </div>

      {/* API Key — hidden for Ollama */}
      {isOllama ? (
        <div style={{ ...groupStyle, fontSize: '0.72rem', color: 'var(--fg-3)', fontStyle: 'italic' }}>
          Not required for local Ollama
        </div>
      ) : (
        <div style={groupStyle}>
          <label style={labelStyle}>API Key</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={llm.apiKey}
              onChange={e => handleApiKeyChange(e.target.value)}
              placeholder="Saved per provider in browser"
              style={{ ...inputStyle, paddingRight: '2.25rem' }}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              title={showKey ? 'Hide key' : 'Show key'}
              style={{
                position: 'absolute',
                right: '0.4rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fg-3)',
                fontSize: '0.75rem',
                padding: '0 0.1rem',
                lineHeight: 1,
              }}
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
        </div>
      )}

      {/* Custom provider: Base URL + API Format */}
      {isCustom && (
        <>
          <div style={groupStyle}>
            <label style={labelStyle}>Base URL</label>
            <input
              type="text"
              value={llm.baseUrl}
              onChange={e => update({ baseUrl: e.target.value })}
              placeholder="https://api.example.com"
              style={inputStyle}
            />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>API Format</label>
            <select
              value={llm.apiFormat ?? 'ollama'}
              onChange={e => update({ apiFormat: e.target.value as ApiFormat })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {API_FORMATS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Concurrency */}
      <div style={groupStyle}>
        <label style={labelStyle}>Concurrency</label>
        <select
          value={llm.maxConcurrent}
          onChange={e => update({ maxConcurrent: Number(e.target.value) })}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value={3}>Sequential (max 3)</option>
          <option value={1000}>Parallel (unlimited)</option>
        </select>
      </div>

      {/* Test Connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={handleTest}
          disabled={testing || (!isOllama && !llm.apiKey)}
          style={{
            height: '2rem',
            padding: '0 0.75rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.75rem',
            cursor: (testing || (!isOllama && !llm.apiKey)) ? 'not-allowed' : 'pointer',
            opacity: (testing || (!isOllama && !llm.apiKey)) ? 0.5 : 1,
          }}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult !== null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: testResult ? '#22c55e' : '#ef4444',
              display: 'inline-block',
            }} />
            <span style={{ color: testResult ? '#22c55e' : '#ef4444' }}>
              {testResult ? 'Connected' : 'Failed'}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
