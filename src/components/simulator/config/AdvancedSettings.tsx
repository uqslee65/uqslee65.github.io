import { useState } from 'react';
import { useSimulator } from '../SimulatorProvider';

function SliderRow({
  label, value, min, max, step = 1, onChange, mono = false,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; onChange: (v: number) => void; mono?: boolean;
}) {
  const display = step < 1 ? value.toFixed(step < 0.1 ? 2 : 2) : String(value);
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
        <label style={{ fontSize: '0.72rem', color: 'var(--fg-2)' }}>{label}</label>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700,
          color: 'var(--accent)',
          fontFamily: mono ? 'monospace' : 'inherit',
        }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', height: '4px' }}
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      fontSize: '0.75rem', color: 'var(--fg-2)', cursor: 'pointer',
      marginBottom: '0.5rem', minHeight: '44px',
    }}>
      <input
        type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
      />
      {label}
    </label>
  );
}

export function AdvancedSettings() {
  const { config, setConfig } = useSimulator();
  const isPlanI = config.plan === 'plan-i';
  const isPlanIIOrIII = config.plan === 'plan-ii' || config.plan === 'plan-iii';

  // Local UI-only state for replacement round (no SimConfig backing field)
  const [replacementRound, setReplacementRound] = useState(4);

  const exp = config.experience;
  const heu = config.heuristics;

  const betaSum = (heu.anchor + heu.trend + heu.dividend + heu.narrative).toFixed(2);
  const betaSumNum = parseFloat(betaSum);

  return (
    <div>
      <SliderRow label="Population N" value={config.nAgents} min={6} max={100}
        onChange={v => setConfig({ nAgents: v })} />
      <SliderRow label="Rounds" value={config.nRounds} min={2} max={10}
        onChange={v => setConfig({ nRounds: v })} />
      <SliderRow label="Replacement round" value={replacementRound} min={2} max={10}
        onChange={setReplacementRound} />

      {isPlanI && (
        <>
          <div style={{ borderTop: '1px solid var(--border)', margin: '0.75rem 0 0.75rem', paddingTop: '0.75rem' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--fg-3)', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Experience Anchors
            </p>
            <SliderRow label="α₀ (novice fundamental weight)" value={exp.alpha0}
              min={0} max={1} step={0.05} onChange={v => setConfig({ experience: { ...exp, alpha0: v } })} mono />
            <SliderRow label="σ₀ (novice valuation noise)" value={exp.sigma0}
              min={0} max={40} step={0.5} onChange={v => setConfig({ experience: { ...exp, sigma0: v } })} mono />
            <SliderRow label="ω₀ (novice self-weight)" value={exp.omega0}
              min={0} max={1} step={0.05} onChange={v => setConfig({ experience: { ...exp, omega0: v } })} mono />
            <SliderRow label="γ_α (fundamental weight growth)" value={exp.gammaAlpha}
              min={0} max={0.5} step={0.01} onChange={v => setConfig({ experience: { ...exp, gammaAlpha: v } })} mono />
            <SliderRow label="γ_σ (noise decay)" value={exp.gammaSigma}
              min={0} max={1} step={0.05} onChange={v => setConfig({ experience: { ...exp, gammaSigma: v } })} mono />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', margin: '0.75rem 0 0.75rem', paddingTop: '0.75rem' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--fg-3)', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Heuristic Weights
            </p>
            <SliderRow label="β₁ anchor" value={heu.anchor}
              min={0} max={1} step={0.05} onChange={v => setConfig({ heuristics: { ...heu, anchor: v } })} mono />
            <SliderRow label="β₂ trend" value={heu.trend}
              min={0} max={1} step={0.05} onChange={v => setConfig({ heuristics: { ...heu, trend: v } })} mono />
            <SliderRow label="β₃ dividend" value={heu.dividend}
              min={0} max={1} step={0.05} onChange={v => setConfig({ heuristics: { ...heu, dividend: v } })} mono />
            <SliderRow label="β₄ narrative" value={heu.narrative}
              min={0} max={1} step={0.05} onChange={v => setConfig({ heuristics: { ...heu, narrative: v } })} mono />
            <div style={{ fontSize: '0.72rem', color: betaSumNum === 1 ? 'var(--fg-3)' : '#ef4444', textAlign: 'right', marginTop: '0.25rem' }}>
              Σβ = {betaSum}{betaSumNum !== 1 ? ' ≠ 1.00' : ''}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', margin: '0.75rem 0 0.75rem', paddingTop: '0.75rem' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--fg-3)', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Toggles
            </p>
            <Checkbox label="Prior Bias" checked={config.priorBias}
              onChange={v => setConfig({ priorBias: v })} />
            <Checkbox label="Prior Noise" checked={config.priorNoise}
              onChange={v => setConfig({ priorNoise: v })} />
          </div>
        </>
      )}

      {isPlanIIOrIII && (
        <div style={{ borderTop: '1px solid var(--border)', margin: '0.75rem 0 0.75rem', paddingTop: '0.75rem' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--fg-3)', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Regulator
          </p>
          {(() => {
            const threshold = config.regulator.threshold;
            const thresholdPct = Math.round(threshold * 100);
            const label = thresholdPct === 0 ? 'OFF' : `Trigger at ${thresholdPct}% mispricing`;
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--fg-2)' }}>Threshold</label>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: thresholdPct === 0 ? 'var(--fg-3)' : 'var(--accent)' }}>
                    {label}
                  </span>
                </div>
                <input
                  type="range"
                  min={0} max={100} step={1}
                  value={thresholdPct}
                  onChange={e => setConfig({
                    regulator: {
                      ...config.regulator,
                      threshold: Number(e.target.value) / 100,
                      enabled: Number(e.target.value) > 0,
                    },
                  })}
                  style={{ width: '100%', accentColor: 'var(--accent)', height: '4px' }}
                />
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
