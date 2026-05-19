import { useSimulator } from './SimulatorProvider';

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--stat-bg)',
      borderRadius: '4px',
      padding: '0.3rem 0.5rem',
    }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: color ?? 'var(--fg)', marginTop: '0.1rem' }}>
        {value}
      </div>
    </div>
  );
}

export function SessionStats() {
  const { config, currentPeriod, currentRound, llmProgress } = useSimulator();

  const period = currentPeriod;
  const price = period?.meanPrice;
  const fv = period?.fv;
  const mispricing = price != null && fv != null && fv !== 0
    ? ((price - fv) / fv * 100)
    : null;
  const volume = period?.trades?.length ?? 0;
  const tick = llmProgress?.tick ?? (period ? '—' : '0');

  const mispricingColor = mispricing != null
    ? (mispricing > 5 ? '#ef4444' : mispricing < -5 ? '#22c55e' : 'var(--fg)')
    : undefined;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gap: '0.35rem',
      marginBottom: '0.5rem',
    }}>
      <Stat label="Session" value={`#${config.seed}`} />
      <Stat label="Round" value={period ? `${currentRound} / ${config.nRounds}` : '—'} />
      <Stat label="Period" value={period ? `${period.period} / ${config.nPeriods}` : '—'} />
      <Stat label="Tick" value={String(tick)} />
      <Stat label="Price" value={price != null ? `${price.toFixed(1)}¢` : '—'} />
      <Stat label="FV" value={fv != null ? `${fv.toFixed(1)}¢` : '—'} />
      <Stat
        label="Mispricing"
        value={mispricing != null ? `${mispricing > 0 ? '+' : ''}${mispricing.toFixed(1)}%` : '—'}
        color={mispricingColor}
      />
      <Stat label="Volume" value={period ? String(volume) : '—'} />
    </div>
  );
}
