import { useSimulator } from '../SimulatorProvider';
import { ASSET_PRESETS } from '../../../lib/sim/assets';
import type { AssetClass } from '../../../lib/sim/types';

interface AssetMeta {
  id: AssetClass;
  label: string;
  short: string;
  shape: string; // inline SVG path d="" for a tiny preview
}

const ASSETS: AssetMeta[] = [
  {
    id: 'linear-declining',
    label: 'Linear Declining (LD)',
    short: 'Classic SSW: FV falls to 0 as dividends run out',
    shape: 'M2,2 L18,14',
  },
  {
    id: 'constant-perpetual',
    label: 'Constant Perpetual (CP)',
    short: 'Gordon growth g=0: constant FV throughout session',
    shape: 'M2,8 L18,8',
  },
  {
    id: 'linear-growth',
    label: 'Linear Growth (LG)',
    short: 'Rising FV starting at fv1, increases each period',
    shape: 'M2,14 L18,2',
  },
  {
    id: 'cyclical',
    label: 'Cyclical (CY)',
    short: 'Sinusoidal FV around fv1 with ±40% amplitude',
    shape: 'M2,8 C6,2 10,14 14,2 L18,8',
  },
  {
    id: 'random-walk',
    label: 'Random Walk (RW)',
    short: 'Pre-seeded Gaussian random walk around fv1',
    shape: 'M2,10 L6,6 L9,11 L12,5 L15,9 L18,7',
  },
  {
    id: 'jump-crash',
    label: 'Jump / Crash (JC)',
    short: 'Calm drift with 10% chance of a −30 crash each period',
    shape: 'M2,10 L8,8 L9,14 L11,8 L18,6',
  },
];

export function AssetClassSelector() {
  const { config, setConfig } = useSimulator();

  const handleSelect = (ac: AssetClass) => {
    setConfig({ assetClass: ac, ...ASSET_PRESETS[ac] });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
      {ASSETS.map(a => {
        const active = config.assetClass === a.id;
        return (
          <button
            key={a.id}
            onClick={() => handleSelect(a.id)}
            style={{
              textAlign: 'left',
              padding: '0.5rem 0.6rem',
              background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))' : 'var(--stat-bg)',
              border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
              minHeight: '44px',
            }}
          >
            {/* Tiny SVG shape preview */}
            <svg
              width="20" height="16"
              viewBox="0 0 20 16"
              style={{ flexShrink: 0, marginTop: '1px' }}
            >
              <path
                d={a.shape}
                fill="none"
                stroke={active ? 'var(--accent)' : 'var(--fg-3)'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: active ? 'var(--accent)' : 'var(--fg)', marginBottom: '0.15rem' }}>
                {a.label}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--fg-3)', lineHeight: 1.3 }}>
                {a.short}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
