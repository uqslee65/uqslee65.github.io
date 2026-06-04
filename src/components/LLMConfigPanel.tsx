import { useState } from 'react';
import type { LLMConfig } from 'zigan-simulation';
import { testConnection } from 'zigan-simulation';

interface Props {
  config: LLMConfig;
  onChange: (config: LLMConfig) => void;
}

export default function LLMConfigPanel({ config, onChange }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const update = (patch: Partial<LLMConfig>) => onChange({ ...config, ...patch });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await testConnection(config);
    setTestResult(ok);
    setTesting(false);
  };

  return (
    <div className="llm-config">
      <div className="control-group">
        <label>Base URL</label>
        <input
          type="text"
          value={config.baseUrl}
          onChange={e => update({ baseUrl: e.target.value })}
          placeholder="/ollama"
          style={{ width: '180px' }}
        />
      </div>
      <div className="control-group">
        <label>API Key</label>
        <input
          type="password"
          value={config.apiKey}
          onChange={e => update({ apiKey: e.target.value })}
          placeholder="Enter API key"
          style={{ width: '180px' }}
        />
      </div>
      <div className="control-group">
        <label>Model</label>
        <input
          type="text"
          value={config.model}
          onChange={e => update({ model: e.target.value })}
          style={{ width: '160px' }}
        />
      </div>
      <div className="control-group">
        <label>Concurrency</label>
        <select
          value={config.maxConcurrent}
          onChange={e => update({ maxConcurrent: Number(e.target.value) })}
        >
          <option value={3}>Sequential (max 3)</option>
          <option value={1000}>Parallel (unlimited)</option>
        </select>
      </div>
      <div className="control-buttons">
        <button onClick={handleTest} disabled={testing || !config.apiKey} className="btn">
          {testing ? 'Testing...' : 'Test'}
        </button>
        {testResult !== null && (
          <span style={{ fontSize: '0.75rem', color: testResult ? '#22c55e' : '#ef4444' }}>
            {testResult ? 'Connected' : 'Failed'}
          </span>
        )}
      </div>
    </div>
  );
}
