import { useSimulator, PUBLISHED } from './SimulatorProvider';
import { Figure } from './Figure';

export function MetricsPanel() {
  const { metrics, currentRound } = useSimulator();

  if (!metrics) {
    const ghostRows: [string][] = [
      ['Haessel R²'],
      ['Norm Abs Dev'],
      ['Norm Avg Dev'],
      ['Amplitude'],
    ];
    return (
      <Figure figNum="1" title="Bubble Metrics — DLM Table 2">
        <div style={{ opacity: 0.4 }}>
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Metric', 'Ours', 'Published', 'Delta %'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--fg-2)',
                    padding: '0.25rem 0.5rem',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ghostRows.map(([name]) => (
                <tr key={name}>
                  <td style={{ padding: '0.25rem 0.5rem', color: 'var(--fg)' }}>{name}</td>
                  <td style={{ padding: '0.25rem 0.5rem', color: 'var(--fg)' }}>—</td>
                  <td style={{ padding: '0.25rem 0.5rem', color: 'var(--fg)' }}>—</td>
                  <td style={{ padding: '0.25rem 0.5rem', color: 'var(--fg-2)' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Figure>
    );
  }

  const published = PUBLISHED[currentRound];
  const rows: [string, number, number][] = [
    ['Haessel R²',   metrics.haesselR2,  published.haesselR2],
    ['Norm Abs Dev', metrics.normAbsDev, published.normAbsDev],
    ['Norm Avg Dev', metrics.normAvgDev, published.normAvgDev],
    ['Amplitude',    metrics.amplitude,  published.amplitude],
  ];

  return (
    <Figure figNum="1" title="Bubble Metrics — DLM Table 2">
      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Metric', 'Ours', 'Published', 'Delta'].map(h => (
              <th key={h} style={{
                textAlign: 'left',
                fontWeight: 600,
                color: 'var(--fg-2)',
                padding: '0.25rem 0.5rem',
                borderBottom: '1px solid var(--border)',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, ours, pub]) => {
            const delta = pub !== 0 ? ((ours - pub) / pub * 100).toFixed(1) : '—';
            const deltaNum = Number(delta);
            return (
              <tr key={name}>
                <td style={{ padding: '0.25rem 0.5rem', color: 'var(--fg)' }}>{name}</td>
                <td style={{ padding: '0.25rem 0.5rem', color: 'var(--fg)' }}>{ours.toFixed(3)}</td>
                <td style={{ padding: '0.25rem 0.5rem', color: 'var(--fg)' }}>{pub.toFixed(2)}</td>
                <td style={{
                  padding: '0.25rem 0.5rem',
                  color: Math.abs(deltaNum) > 50 ? '#ef4444' : 'var(--fg-2)',
                }}>
                  {delta}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Figure>
  );
}
