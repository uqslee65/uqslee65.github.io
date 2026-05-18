import { Figure } from '../Figure';

interface BatchRow {
  id: string;        // e.g. R1_S1
  dev: number;
  turn: number;
  vol: number;
  payoff: number;
}

interface Props {
  rows?: BatchRow[];
}

export function Table2BatchResults({ rows }: Props) {
  const hasData = rows && rows.length > 0;

  const headerStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--fg-2)',
    textAlign: 'right' as const,
    padding: '0.25rem 0.5rem',
    borderBottom: '1px solid var(--border)',
  };
  const cellStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    color: 'var(--fg)',
    textAlign: 'right' as const,
    padding: '0.2rem 0.5rem',
    fontVariantNumeric: 'tabular-nums',
  };
  const idStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: 'left' as const,
    color: 'var(--fg-2)',
    fontFamily: 'monospace',
  };

  return (
    <Figure figNum="Table 2" title="10-Session Batch Results">
      {!hasData ? (
        <div style={{ overflowX: 'auto', opacity: 0.4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...headerStyle, textAlign: 'left' }}>Session</th>
                <th style={headerStyle}>Dev</th>
                <th style={headerStyle}>Turnover</th>
                <th style={headerStyle}>Vol</th>
                <th style={headerStyle}>Payoff</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map(i => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--stat-bg)' }}>
                  <td style={{ ...idStyle }}>—</td>
                  <td style={cellStyle}>—</td>
                  <td style={cellStyle}>—</td>
                  <td style={cellStyle}>—</td>
                  <td style={cellStyle}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...headerStyle, textAlign: 'left' }}>Session</th>
                <th style={headerStyle}>Dev</th>
                <th style={headerStyle}>Turnover</th>
                <th style={headerStyle}>Vol</th>
                <th style={headerStyle}>Payoff</th>
              </tr>
            </thead>
            <tbody>
              {rows!.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--stat-bg)' }}>
                  <td style={idStyle}>{row.id}</td>
                  <td style={cellStyle}>{row.dev.toFixed(3)}</td>
                  <td style={cellStyle}>{row.turn.toFixed(3)}</td>
                  <td style={cellStyle}>{row.vol}</td>
                  <td style={cellStyle}>{row.payoff.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Figure>
  );
}
