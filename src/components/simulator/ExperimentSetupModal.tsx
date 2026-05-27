import { useState } from 'react';
import { useSimulator } from './SimulatorProvider';
import { testConnection } from '../../lib/sim/llm-client';
import type { AssetClass, PlanType, LLMConfig, LLMProvider, AssetConfig } from '../../lib/sim/types';
import { LLM_SCALED_DEFAULTS } from '../../lib/sim/types';
import { RiskPreferences } from './config/RiskPreferences';
import { PROVIDER_PRESETS } from '../../lib/sim/providers';

interface ExperimentSetupModalProps {
  onClose: () => void;
  onRun: () => void;
  initialStep?: number;
}

// --- Static data ---

const PLAN_OPTIONS: { id: PlanType; label: string; short: string; desc: string }[] = [
  {
    id: 'plan-i',
    label: 'Plan I',
    short: 'Algorithmic',
    desc: 'Deterministic belief-update agents. No API key needed. Fast, reproducible runs.',
  },
  {
    id: 'plan-ii',
    label: 'Plan II',
    short: 'LLM + Utility',
    desc: 'LLM agents receive an explicit CRRA utility function. Requires an API key.',
  },
  {
    id: 'plan-iii',
    label: 'Plan III',
    short: 'LLM + Risk Label',
    desc: 'LLM agents receive only a risk-preference label. Requires an API key.',
  },
];

const ASSET_OPTIONS: { id: AssetClass; label: string; desc: string }[] = [
  { id: 'linear-declining',   label: 'Linear Declining',   desc: 'FV drops linearly as the asset approaches expiry (DLM baseline).' },
  { id: 'constant-perpetual', label: 'Constant Perpetual', desc: 'Infinite life; constant dividend → fixed FV = 100¢.' },
  { id: 'linear-growth',      label: 'Linear Growth',      desc: 'Expected dividend grows each period, so FV rises before expiry.' },
  { id: 'cyclical',           label: 'Cyclical',           desc: 'Dividend alternates between high and low phases.' },
  { id: 'random-walk',        label: 'Random Walk',        desc: 'FV follows a random walk — no exploitable trend.' },
  { id: 'jump-crash',         label: 'Jump / Crash',       desc: 'FV is stable until a latent crash event wipes out value.' },
];

// --- Shared style atoms ---

const labelSm: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'var(--fg-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-card)',
  color: 'var(--fg)',
  fontSize: '0.8rem',
};

const btnBase: React.CSSProperties = {
  padding: '0.4rem 0.9rem',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-card)',
  color: 'var(--fg)',
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent)',
  color: 'white',
  borderColor: 'var(--accent)',
};

const btnSuccess: React.CSSProperties = {
  ...btnBase,
  background: '#22c55e',
  color: 'white',
  borderColor: '#22c55e',
};

const btnDisabled: React.CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

// --- Step dot indicator ---

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i + 1 === current ? '18px' : '8px',
            height: '8px',
            borderRadius: '4px',
            background: i + 1 === current ? 'var(--accent)' : 'var(--border)',
            transition: 'width 0.2s, background 0.2s',
          }}
        />
      ))}
      <span style={{ fontSize: '0.7rem', color: 'var(--fg-3)', marginLeft: '0.3rem' }}>
        Step {current} of {total}
      </span>
    </div>
  );
}

// --- Main modal ---

export function ExperimentSetupModal({
  onClose,
  onRun,
  initialStep = 1,
}: ExperimentSetupModalProps) {
  const { config, setConfig, isLLM } = useSimulator();

  const [currentStep, setCurrentStep] = useState(initialStep);

  // LLM config local state (mirrors config.llm, written to context on change)
  const [llmLocal, setLlmLocal] = useState<LLMConfig>(() => {
    const defaultProvider = config.llm?.provider ?? 'gemini';
    const preset = PROVIDER_PRESETS[defaultProvider];
    return {
      baseUrl: config.llm?.baseUrl ?? preset.baseUrl,
      apiKey:  config.llm?.apiKey  ?? '',
      model:   config.llm?.model   ?? (preset.models[0] ?? ''),
      maxConcurrent: config.llm?.maxConcurrent ?? 3,
      provider: defaultProvider,
      apiFormat: config.llm?.apiFormat ?? preset.apiFormat,
    };
  });

  // Provider selection state
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>(
    config.llm?.provider ?? 'gemini'
  );

  // Multi-asset selection state
  const [selectedAssets, setSelectedAssets] = useState<Set<AssetClass>>(() => {
    const assets = config.assets ?? [{ id: config.assetClass, weight: 1 }];
    return new Set(assets.map((a: AssetConfig) => a.id));
  });
  const [assetWeights, setAssetWeights] = useState<Record<string, number>>(() => {
    const assets = config.assets ?? [{ id: config.assetClass, weight: 1 }];
    const weights: Record<string, number> = {};
    for (const a of assets) weights[a.id] = a.weight;
    return weights;
  });

  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const [saveAsDefaults, setSaveAsDefaults] = useState(false);

  // Derived
  const planIsLLM = config.plan !== 'plan-i';
  const totalSteps = planIsLLM ? 5 : 4;
  const displayStep = (!planIsLLM && currentStep === 5) ? 4 : currentStep;

  // Helpers to push LLM edits into both local and context
  const updateLlm = (patch: Partial<LLMConfig>) => {
    const next = { ...llmLocal, ...patch };
    setLlmLocal(next);
    setConfig({ llm: next });
    if (patch.apiKey !== undefined || patch.baseUrl !== undefined || patch.model !== undefined) {
      setTestResult(null);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await testConnection(llmLocal);
    setTestResult(ok);
    setTesting(false);
  };

  const handleNext = () => {
    if (currentStep === 1) { setCurrentStep(2); return; }
    if (currentStep === 2) {
      // Sync selected assets to config
      const assets: AssetConfig[] = [...selectedAssets].map(id => ({
        id,
        weight: selectedAssets.size === 1 ? 1 : (assetWeights[id] ?? 1 / selectedAssets.size),
      }));
      setConfig({ assets, assetClass: assets[0].id });
      setCurrentStep(3);
      return;
    }
    if (currentStep === 3) { setCurrentStep(planIsLLM ? 4 : 5); return; }
    if (currentStep === 4) { setCurrentStep(5); return; }
  };

  const handleBack = () => {
    if (currentStep === 2) { setCurrentStep(1); return; }
    if (currentStep === 3) { setCurrentStep(2); return; }
    if (currentStep === 4) { setCurrentStep(3); return; }
    if (currentStep === 5) { setCurrentStep(planIsLLM ? 4 : 3); return; }
  };

  const handleRun = () => {
    if (saveAsDefaults) {
      const toSave = {
        plan:      config.plan,
        assets:    [...selectedAssets].map(id => ({ id, weight: assetWeights[id] ?? 1 })),
        nAgents:   config.nAgents,
        riskSplit: config.riskSplit,
        llm: planIsLLM ? {
          baseUrl:       llmLocal.baseUrl,
          model:         llmLocal.model,
          maxConcurrent: llmLocal.maxConcurrent,
          provider:      llmLocal.provider,
          apiFormat:     llmLocal.apiFormat,
          // intentionally omit apiKey
        } : undefined,
      };
      try { localStorage.setItem('sim-defaults', JSON.stringify(toSave)); } catch {}
    }
    onRun();
    onClose();
  };

  // --- Risk split labels ---
  const [lov, neu, av] = config.riskSplit;

  // --- Summary asset display ---
  const assetSummary = selectedAssets.size === 1
    ? ASSET_OPTIONS.find(a => a.id === [...selectedAssets][0])?.label ?? ''
    : [...selectedAssets].map(id => {
        const label = ASSET_OPTIONS.find(a => a.id === id)?.label ?? id;
        const totalRaw = [...selectedAssets].reduce((s, aid) => s + (assetWeights[aid] ?? 1), 0);
        const pct = Math.round(((assetWeights[id] ?? 1) / totalRaw) * 100);
        return `${label} (${pct}%)`;
      }).join(' + ');

  return (
    <div
      data-testid="setup-modal"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '80vh',
          overflowY: 'auto',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '0.75rem', right: '0.75rem',
            background: 'transparent', border: 'none',
            color: 'var(--fg-2)', fontSize: '1.1rem', cursor: 'pointer',
            lineHeight: 1, padding: '0.25rem 0.4rem', borderRadius: '4px',
          }}
          aria-label="Close setup"
        >
          &times;
        </button>

        {/* Header */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '0.5rem' }}>
            Experiment Setup
          </h2>
          <StepDots current={displayStep} total={totalSteps} />
        </div>

        {/* ── Step 1: Choose Plan ── */}
        {currentStep === 1 && (
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-2)', marginBottom: '0.75rem' }}>
              Select the agent decision model for this experiment.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {PLAN_OPTIONS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setConfig({ plan: p.id })}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '0.75rem 1rem',
                    border: `2px solid ${config.plan === p.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    background: config.plan === p.id ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-card))' : 'var(--bg-card)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                    width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fg)' }}>{p.label}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>{p.short}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-2)', lineHeight: 1.45 }}>{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Asset Portfolio ── */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-2)', marginBottom: '0.25rem' }}>
              Select one or more asset classes for the experiment.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {ASSET_OPTIONS.map(a => {
                const checked = selectedAssets.has(a.id);
                return (
                  <label key={a.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                    padding: '0.5rem 0.75rem',
                    border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '6px',
                    background: checked ? 'color-mix(in srgb, var(--accent) 6%, var(--bg-card))' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = new Set(selectedAssets);
                        if (checked && next.size > 1) next.delete(a.id);
                        else next.add(a.id);
                        setSelectedAssets(next);
                        // Initialize weight for newly added asset
                        if (!checked) {
                          setAssetWeights(prev => ({ ...prev, [a.id]: 1 }));
                        }
                      }}
                      style={{ marginTop: '0.1rem', accentColor: 'var(--accent)' }}
                    />
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--fg)' }}>{a.label}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--fg-2)', display: 'block', lineHeight: 1.4 }}>{a.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Weight sliders — only shown when 2+ assets selected */}
            {selectedAssets.size > 1 && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ ...labelSm, marginBottom: '0.5rem', display: 'block' }}>Portfolio Weights</p>
                {[...selectedAssets].map(id => {
                  const label = ASSET_OPTIONS.find(a => a.id === id)?.label ?? id;
                  const rawWeight = assetWeights[id] ?? 1;
                  const totalRaw = [...selectedAssets].reduce((s, aid) => s + (assetWeights[aid] ?? 1), 0);
                  const pct = Math.round((rawWeight / totalRaw) * 100);
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--fg)', minWidth: '120px' }}>{label}</span>
                      <input
                        type="range" min={1} max={10} step={1}
                        value={rawWeight}
                        onChange={e => setAssetWeights(prev => ({ ...prev, [id]: Number(e.target.value) }))}
                        style={{ flex: 1, accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--fg)', minWidth: '2.5rem', textAlign: 'right' }}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Agents + Risk Preferences ── */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Number of agents */}
            <div>
              <p style={{ ...labelSm, marginBottom: '0.4rem', display: 'block' }}>
                Number of Agents
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="range"
                  min={6}
                  max={100}
                  step={1}
                  value={config.nAgents}
                  onChange={e => setConfig({ nAgents: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fg)', minWidth: '2.5rem', textAlign: 'right' }}>
                  {config.nAgents}
                </span>
              </div>
            </div>

            {/* Risk split sliders */}
            <div>
              <p style={{ ...labelSm, marginBottom: '0.75rem', display: 'block' }}>Risk Split</p>
              <RiskPreferences />
            </div>
          </div>
        )}

        {/* ── Step 4: API Config (LLM plans only) ── */}
        {currentStep === 4 && planIsLLM && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-2)', margin: 0 }}>
              Configure the LLM backend for {config.plan === 'plan-ii' ? 'Plan II' : 'Plan III'}.
              The API key is used only in-browser and is never sent to any server other than the
              configured Base URL.
            </p>

            {/* Provider dropdown */}
            <div>
              <label style={{ ...labelSm, display: 'block', marginBottom: '0.3rem' }}>Provider</label>
              <select
                value={selectedProvider}
                onChange={e => {
                  const key = e.target.value as LLMProvider;
                  setSelectedProvider(key);
                  const preset = PROVIDER_PRESETS[key];
                  updateLlm({
                    baseUrl:   preset.baseUrl,
                    apiFormat: preset.apiFormat,
                    provider:  key,
                    model:     preset.models[0] ?? llmLocal.model,
                  });
                }}
                style={{ ...inputStyle, width: 'auto' }}
              >
                {Object.entries(PROVIDER_PRESETS)
                  .filter(([, p]) => !p.label.includes('disabled'))
                  .map(([key, preset]) => (
                  <option key={key} value={key}>{preset.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ ...labelSm, display: 'block', marginBottom: '0.3rem' }}>API Key</label>
              <input
                type="password"
                value={llmLocal.apiKey}
                onChange={e => updateLlm({ apiKey: e.target.value })}
                placeholder="Enter API key"
                style={inputStyle}
                autoComplete="off"
              />
            </div>

            <div>
              <label style={{ ...labelSm, display: 'block', marginBottom: '0.3rem' }}>Base URL</label>
              <input
                type="text"
                value={llmLocal.baseUrl}
                onChange={e => updateLlm({ baseUrl: e.target.value })}
                placeholder="/ollama"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ ...labelSm, display: 'block', marginBottom: '0.3rem' }}>Model</label>
              {PROVIDER_PRESETS[selectedProvider]?.models.length > 0 ? (
                <select
                  value={llmLocal.model}
                  onChange={e => updateLlm({ model: e.target.value })}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  {PROVIDER_PRESETS[selectedProvider].models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__custom__">Custom…</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={llmLocal.model}
                  onChange={e => updateLlm({ model: e.target.value })}
                  placeholder="model-name"
                  style={inputStyle}
                />
              )}
            </div>

            <div>
              <label style={{ ...labelSm, display: 'block', marginBottom: '0.3rem' }}>Concurrency</label>
              <select
                value={llmLocal.maxConcurrent}
                onChange={e => updateLlm({ maxConcurrent: Number(e.target.value) })}
                style={{ ...inputStyle, width: 'auto' }}
              >
                <option value={3}>Sequential (max 3)</option>
                <option value={1000}>Parallel (unlimited)</option>
              </select>
            </div>

            {/* Test connection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={handleTest}
                disabled={testing || !llmLocal.apiKey}
                style={{
                  ...btnBase,
                  ...(testing || !llmLocal.apiKey ? btnDisabled : {}),
                }}
              >
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
              {testResult !== null && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: testResult ? '#22c55e' : '#ef4444',
                }}>
                  {testResult ? '● Connected' : '● Failed'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Step 5: Summary & Run ── */}
        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-2)', margin: 0 }}>
              Review your experiment configuration before running.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  { label: 'Plan',       value: PLAN_OPTIONS.find(p => p.id === config.plan)?.label + ' — ' + PLAN_OPTIONS.find(p => p.id === config.plan)?.short },
                  { label: 'Assets',     value: assetSummary },
                  { label: 'Agents',     value: String(config.nAgents) },
                  {
                    label: 'Risk Split',
                    value: `${Math.round(lov * 100)}% Loving / ${Math.round(neu * 100)}% Neutral / ${Math.round(av * 100)}% Averse`,
                  },
                  ...(planIsLLM ? [
                    { label: 'Provider',    value: PROVIDER_PRESETS[selectedProvider]?.label ?? selectedProvider },
                    { label: 'LLM Model',   value: llmLocal.model || '—' },
                    { label: 'Base URL',    value: llmLocal.baseUrl || '—' },
                    { label: 'API Key',     value: llmLocal.apiKey ? '••••' + llmLocal.apiKey.slice(-4) : 'Not set' },
                  ] : []),
                ].map(row => (
                  <tr key={row.label}>
                    <td style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.3rem 0.6rem 0.3rem 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      {row.label}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--fg)', padding: '0.3rem 0' }}>
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Save as defaults */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={saveAsDefaults}
                onChange={e => setSaveAsDefaults(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-2)' }}>
                Save as defaults (localStorage, API key excluded)
              </span>
            </label>

            {/* LLM API key warning */}
            {planIsLLM && !llmLocal.apiKey && (
              <div style={{
                padding: '0.6rem 0.75rem',
                background: 'color-mix(in srgb, #ef4444 10%, var(--bg-card))',
                border: '1px solid color-mix(in srgb, #ef4444 30%, var(--border))',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#ef4444',
              }}>
                No API key set. Go back to Step 4 to configure one before running.
              </div>
            )}
          </div>
        )}

        {/* ── Navigation footer ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.25rem' }}>
          <div>
            {currentStep > 1 && (
              <button onClick={handleBack} style={btnBase}>
                ← Back
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {currentStep < 5 && (
              <button onClick={handleNext} style={btnPrimary}>
                Next →
              </button>
            )}
            {currentStep === 5 && (
              <>
                <button onClick={onClose} style={btnBase}>Cancel</button>
                <button
                  data-testid="run-experiment"
                  onClick={handleRun}
                  disabled={planIsLLM && !llmLocal.apiKey}
                  style={{
                    ...btnSuccess,
                    ...(planIsLLM && !llmLocal.apiKey ? btnDisabled : {}),
                  }}
                >
                  Run Experiment
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
