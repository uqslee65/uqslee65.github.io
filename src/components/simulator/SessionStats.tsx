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

function LLMProgressBar({ progress, config }: {
  progress: { round: number; period: number; tick: number; status: string };
  config: { nRounds: number; nPeriods: number; ticksPerPeriod: number };
}) {
  const totalTicks = config.nRounds * config.nPeriods * config.ticksPerPeriod;
  const completedTicks =
    ((progress.round - 1) * config.nPeriods + (progress.period - 1)) * config.ticksPerPeriod
    + progress.tick;
  const pct = Math.min(100, Math.round((completedTicks / totalTicks) * 100));

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '0.7rem', color: 'var(--fg-2)', marginBottom: '0.25rem',
      }}>
        <span>
          Round {progress.round}/{config.nRounds} · Period {progress.period}/{config.nPeriods} · Tick {progress.tick}/{config.ticksPerPeriod}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
      </div>
      <div style={{
        height: '6px', borderRadius: '3px',
        background: 'var(--border)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          background: 'var(--accent)',
          width: `${pct}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{
        fontSize: '0.65rem', color: 'var(--fg-3)', marginTop: '0.2rem',
      }}>
        {progress.status}
      </div>
    </div>
  );
}

export function SessionStats() {
  const { config, currentPeriod, currentRound, llmRunning, llmProgress } = useSimulator();

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
    <div>
      {llmRunning && llmProgress && (
        <LLMProgressBar progress={llmProgress} config={config} />
      )}
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
    </div>
  );
}
