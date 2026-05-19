import { useSimulator } from '../SimulatorProvider';
import { TOOLTIPS } from '../../../lib/sim/tooltips';

function SliderRow({
  label, value, min, max, onChange, tooltip,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; tooltip?: string }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--fg-2)' }} title={tooltip}>{label}</label>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', minWidth: '2rem', textAlign: 'right' }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', height: '4px' }}
      />
    </div>
  );
}

export function TradeSettings({ compact = false }: { compact?: boolean }) {
  const { config, setConfig } = useSimulator();
  const N = config.nAgents;
  const F = config.nFundamentalists;
  const T = config.nTrendFollowers;
  const utility = Math.max(0, N - F - T);

  const setF = (v: number) => {
    const newF = Math.min(v, N - T);
    setConfig({ nFundamentalists: newF });
  };

  const setT = (v: number) => {
    const newT = Math.min(v, N - F);
    setConfig({ nTrendFollowers: newT });
  };

  return (
    <div>
      <div style={{
        display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
        fontSize: '0.72rem', color: 'var(--fg-3)',
        background: 'var(--stat-bg)',
        borderRadius: '6px',
        padding: '0.5rem 0.75rem',
        marginBottom: compact ? 0 : '1rem',
      }}>
        <span>Utility: <strong style={{ color: 'var(--fg)' }}>{utility}</strong></span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span>Fundamental: <strong style={{ color: 'var(--fg)' }}>{F}</strong></span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span>Trend: <strong style={{ color: 'var(--fg)' }}>{T}</strong></span>
      </div>
      {!compact && (
        <>
          <SliderRow label="Fundamentalists N(F)" value={F} min={0} max={99} onChange={setF} tooltip={TOOLTIPS['trade.fundamentalists']} />
          <SliderRow label="Trend Followers N(T)" value={T} min={0} max={99} onChange={setT} tooltip={TOOLTIPS['trade.trendFollowers']} />
        </>
      )}
    </div>
  );
}
