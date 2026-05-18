export function PaperConstants() {
  const rows: [string, string][] = [
    ['N (subjects/session)', '10 (paper); configurable here'],
    ['Rounds/session', '4'],
    ['T (periods/round)', '20'],
    ['Dividend', '∈ {0, 10}¢, μ_d = 5¢'],
    ['FV at period t', 'FV_t = (T − t + 1) × 5¢'],
    ['Endowment cash', '~U[800, 1200]¢'],
    ['Endowment shares', '~U{2, 3, 4}'],
    ['Sessions', '10 (5 per treatment)'],
  ];

  return (
    <div>
      <p style={{ fontSize: '0.7rem', color: 'var(--fg-3)', marginBottom: '0.5rem' }}>
        Original DLM (2005) paper parameters for reference.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.3rem 0.5rem 0.3rem 0', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                {label}
              </td>
              <td style={{ padding: '0.3rem 0 0.3rem 0.5rem', color: 'var(--fg-2)', fontFamily: 'monospace' }}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
