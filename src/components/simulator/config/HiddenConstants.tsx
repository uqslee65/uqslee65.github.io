export function HiddenConstants() {
  const rows: [string, string][] = [
    ['Ticks/period', '18'],
    ['Naive prior weight ω₀', '0.60'],
    ['Trust learning rate λ', '0.30'],
    ['Passive fill probability', '0.30'],
    ['Bias magnitude', '15%'],
    ['Self-weight step Δω', '0.10'],
    ['k_max', '3'],
  ];

  return (
    <div>
      <p style={{ fontSize: '0.7rem', color: 'var(--fg-3)', marginBottom: '0.5rem', fontStyle: 'italic' }}>
        Simulator implementation constants — not from the paper.
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
