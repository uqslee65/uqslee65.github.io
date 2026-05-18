import { useSimulator } from '../SimulatorProvider';

export function RiskPreferences() {
  const { config, setConfig } = useSimulator();
  const [loving, neutral, averse] = config.riskSplit;

  const lovingPct = Math.round(loving * 100);
  const neutralPct = Math.round(neutral * 100);
  const aversePct = Math.round(averse * 100);

  const handleChange = (idx: 0 | 1 | 2, newPct: number) => {
    const clampedNew = Math.max(0, Math.min(100, newPct));
    const oldPct = [lovingPct, neutralPct, aversePct][idx];
    const delta = clampedNew - oldPct;
    const others = [0, 1, 2].filter(i => i !== idx) as (0 | 1 | 2)[];
    const pcts = [lovingPct, neutralPct, aversePct];
    pcts[idx] = clampedNew;

    const otherSum = pcts[others[0]] + pcts[others[1]];
    if (otherSum === 0) {
      // Split evenly
      pcts[others[0]] = Math.floor((100 - clampedNew) / 2);
      pcts[others[1]] = 100 - clampedNew - pcts[others[0]];
    } else {
      // Adjust proportionally
      const ratio0 = pcts[others[0]] / otherSum;
      const remaining = 100 - clampedNew;
      pcts[others[0]] = Math.round(ratio0 * remaining);
      pcts[others[1]] = remaining - pcts[others[0]];
    }

    // Clamp negatives
    pcts[others[0]] = Math.max(0, pcts[others[0]]);
    pcts[others[1]] = Math.max(0, pcts[others[1]]);
    // Final renormalize
    const total = pcts[0] + pcts[1] + pcts[2];
    if (total !== 100) pcts[others[1]] += 100 - total;

    setConfig({
      riskSplit: [pcts[0] / 100, pcts[1] / 100, pcts[2] / 100],
    });
  };

  const tiers = [
    { label: 'Risk-Loving', sublabel: 'ρ ∈ (−1, 0)', pct: lovingPct, color: '#ef4444', idx: 0 as const },
    { label: 'Risk-Neutral', sublabel: 'ρ = 0', pct: neutralPct, color: '#9ca3af', idx: 1 as const },
    { label: 'Risk-Averse', sublabel: 'ρ ∈ (0, 1)', pct: aversePct, color: '#22c55e', idx: 2 as const },
  ];

  return (
    <div>
      {/* Composition bar */}
      <div style={{
        display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden',
        marginBottom: '1rem', gap: '2px',
      }}>
        {tiers.map(t => (
          <div key={t.idx} style={{
            flex: t.pct, background: t.color, transition: 'flex 0.2s', minWidth: t.pct > 0 ? '4px' : '0',
          }} />
        ))}
      </div>

      {tiers.map(t => (
        <div key={t.idx} style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-2)' }}>{t.label}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--fg-3)', marginLeft: '0.4rem' }}>{t.sublabel}</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: t.color }}>
              {t.pct}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={t.pct}
            onChange={e => handleChange(t.idx, Number(e.target.value))}
            style={{ width: '100%', accentColor: t.color, height: '4px' }}
          />
        </div>
      ))}
    </div>
  );
}
