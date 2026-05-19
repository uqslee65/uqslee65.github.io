import { useSimulator } from './SimulatorProvider';
import type { PlanType } from '../../lib/sim/types';

const PLANS: { value: PlanType; label: string; desc: string; tooltip: string }[] = [
  { value: 'plan-i',   label: 'Plan I',   desc: 'Algorithmic',     tooltip: 'Algorithmic agents with deterministic belief updates. No API key needed. Fast, reproducible runs.' },
  { value: 'plan-ii',  label: 'Plan II',  desc: 'LLM + Utility',   tooltip: 'LLM agents receive an explicit CRRA utility function in their prompt. Requires an API key.' },
  { value: 'plan-iii', label: 'Plan III', desc: 'LLM + Risk Label', tooltip: 'LLM agents receive only a risk-preference label (e.g. \'risk-loving\'). Requires an API key.' },
];

export function PlanSelector() {
  const { config, setConfig } = useSimulator();

  return (
    <>
      <div
        className="plan-selector"
        style={{
          display: 'flex',
          gap: 0,
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '0.75rem',
        }}
      >
        {PLANS.map(p => {
          const active = config.plan === p.value;
          return (
            <button
              key={p.value}
              title={p.tooltip}
              onClick={() => setConfig({ plan: p.value })}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: 'none',
                borderRight: p.value !== 'plan-iii' ? '1px solid var(--border)' : 'none',
                background: active ? 'var(--accent)' : 'var(--bg-card)',
                color: active ? 'white' : 'var(--fg)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.1rem',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{p.label}</span>
              <span style={{ fontSize: '0.65rem', opacity: active ? 0.9 : 0.7 }}>{p.desc}</span>
            </button>
          );
        })}
      </div>
      <style>{`
        @media (max-width: 480px) {
          .plan-selector {
            flex-direction: column;
          }
          .plan-selector button {
            min-height: 44px;
            border-right: none !important;
            border-bottom: 1px solid var(--border);
          }
          .plan-selector button:last-child {
            border-bottom: none;
          }
        }
      `}</style>
    </>
  );
}
