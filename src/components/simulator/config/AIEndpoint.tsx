import { useState } from 'react';
import { useSimulator } from '../SimulatorProvider';
import { testConnection } from '../../../lib/sim/llm-client';

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

  if (config.plan === 'plan-i') {
    return (
      <p style={{ fontSize: '0.8rem', color: 'var(--fg-3)', margin: 0 }}>
        Plan I uses algorithmic agents — no API configuration needed.
      </p>
    );
  }

  const llm = config.llm ?? { baseUrl: '/ollama', apiKey: '', model: 'gemini-3-flash-preview', maxConcurrent: 3 };

  const update = (patch: Partial<typeof llm>) =>
    setConfig({ llm: { ...llm, ...patch } });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await testConnection(llm);
    setTestResult(ok);
    setTesting(false);
  };

  const labelStyle: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--fg-3)', marginBottom: '0.25rem', display: 'block' };
  const groupStyle: React.CSSProperties = { marginBottom: '0.75rem' };

  return (
    <div>
      <div style={groupStyle}>
        <label style={labelStyle}>Base URL</label>
        <input
          type="text"
          value={llm.baseUrl}
          onChange={e => update({ baseUrl: e.target.value })}
          placeholder="/ollama"
          style={inputStyle}
        />
      </div>
      <div style={groupStyle}>
        <label style={labelStyle}>API Key</label>
        <input
          type="password"
          value={llm.apiKey}
          onChange={e => update({ apiKey: e.target.value })}
          placeholder="Enter API key"
          style={inputStyle}
        />
      </div>
      <div style={groupStyle}>
        <label style={labelStyle}>Model</label>
        <input
          type="text"
          value={llm.model}
          onChange={e => update({ model: e.target.value })}
          style={inputStyle}
        />
      </div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={handleTest}
          disabled={testing || !llm.apiKey}
          style={{
            height: '2rem',
            padding: '0 0.75rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.75rem',
            cursor: testing || !llm.apiKey ? 'not-allowed' : 'pointer',
            opacity: testing || !llm.apiKey ? 0.5 : 1,
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
