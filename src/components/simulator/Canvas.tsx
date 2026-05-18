import { PriceChart } from './PriceChart';
import { RoundStrip } from './RoundStrip';
import { FigureGroups } from './FigureGroups';
import { MetricsPanel } from './MetricsPanel';
import { Table2BatchResults } from './tables/Table2BatchResults';
import { TraceInspector } from './replay/TraceInspector';

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
