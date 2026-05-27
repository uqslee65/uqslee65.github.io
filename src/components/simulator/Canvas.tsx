import { PriceChart } from './PriceChart';
import { RoundStrip } from './RoundStrip';
import { FigureGroups } from './FigureGroups';
import { MetricsPanel } from './MetricsPanel';
import { Table2BatchResults } from './tables/Table2BatchResults';
import { TraceInspector } from './replay/TraceInspector';
import { useSimulator } from './SimulatorProvider';

const ASSET_LABELS: Record<string, string> = {
  'linear-declining': 'Linear Declining',
  'constant-perpetual': 'Constant Perpetual',
  'linear-growth': 'Linear Growth',
  'cyclical': 'Cyclical',
  'random-walk': 'Random Walk',
  'jump-crash': 'Jump / Crash',
};

function AssetTabSelector() {
  const { config, selectedAssetIdx, setSelectedAssetIdx } = useSimulator();
  const assets = config.assets ?? [{ id: config.assetClass, weight: 1 }];
  if (assets.length <= 1) return null;

  return (
    <div data-testid="asset-tabs" style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', padding: '0.25rem', background: 'var(--bg-surface)', borderRadius: '6px' }}>
      {assets.map((a, i) => (
        <button
          key={a.id}
          onClick={() => setSelectedAssetIdx(i)}
          style={{
            padding: '0.3rem 0.6rem',
            fontSize: '0.72rem',
            fontWeight: selectedAssetIdx === i ? 700 : 400,
            border: 'none',
            borderRadius: '4px',
            background: selectedAssetIdx === i ? 'var(--accent)' : 'transparent',
            color: selectedAssetIdx === i ? 'white' : 'var(--fg-2)',
            cursor: 'pointer',
          }}
        >
          {ASSET_LABELS[a.id] ?? a.id}
        </button>
      ))}
    </div>
  );
}

export function Canvas() {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      <AssetTabSelector />
      <PriceChart />
      <RoundStrip />
      <FigureGroups />

      <details style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        <summary style={{
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
          color: 'var(--fg)',
        }}>
          Batch Results
        </summary>
        <div style={{ padding: '0 0.75rem 0.75rem' }}>
          <Table2BatchResults />
        </div>
      </details>

      <details style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        <summary style={{
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
          color: 'var(--fg)',
        }}>
          Replay Trace
        </summary>
        <div style={{ padding: '0 0.75rem 0.75rem' }}>
          <TraceInspector />
        </div>
      </details>
    </div>
  );
}
