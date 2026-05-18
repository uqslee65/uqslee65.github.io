import { useSimulator } from '../SimulatorProvider';

export function ReplayControls() {
  const { activeIdx, activePeriods, replayMode, seek, goLive } = useSimulator();

  const totalPeriods = activePeriods?.length ?? 0;
  const hasData = totalPeriods > 0 && activeIdx >= 0;
  const atStart = activeIdx <= 0;
  const atEnd = activeIdx >= totalPeriods - 1;
  const isLive = replayMode === 'live';

  const btnBase: React.CSSProperties = {
    padding: '0.3rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    borderRadius: '6px',
    background: 'var(--stat-bg)',
    color: 'var(--fg-2)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.1s',
  };

  const disabledBtn: React.CSSProperties = {
    ...btnBase,
    opacity: 0.3,
    cursor: 'not-allowed',
  };

  const liveBtn: React.CSSProperties = {
    ...btnBase,
    background: isLive ? 'var(--accent)' : 'var(--stat-bg)',
    color: isLive ? '#fff' : 'var(--fg-2)',
    borderColor: isLive ? 'var(--accent)' : 'var(--border)',
  };

  const posLabel = !hasData
    ? 'No data'
    : isLive
    ? `Live — Period ${activeIdx + 1}`
    : `Replay — Period ${activeIdx + 1} of ${totalPeriods}`;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 0',
    }}>
      <button
        style={!hasData || atStart ? disabledBtn : btnBase}
        disabled={!hasData || atStart}
        onClick={() => seek(activeIdx - 1)}
        title="Step back"
      >
        {'<<'}
      </button>

      <button
        style={!hasData ? { ...liveBtn, opacity: 0.3, cursor: 'not-allowed' } : liveBtn}
        disabled={!hasData}
        onClick={goLive}
        title="Go to latest"
      >
        ● Live
      </button>

      <button
        style={!hasData || atEnd ? disabledBtn : btnBase}
        disabled={!hasData || atEnd}
        onClick={() => seek(activeIdx + 1)}
        title="Step forward"
      >
        {'>>'}
      </button>

      <input
        type="range"
        min={0}
        max={Math.max(0, totalPeriods - 1)}
        value={hasData ? activeIdx : 0}
        disabled={!hasData}
        onChange={e => seek(Number(e.target.value))}
        style={{ flex: 1, cursor: hasData ? 'pointer' : 'not-allowed', accentColor: 'var(--accent)' }}
      />

      <span style={{
        fontSize: '0.7rem',
        color: isLive ? 'var(--accent)' : 'var(--fg-3)',
        fontWeight: isLive ? 600 : 400,
        flexShrink: 0,
        minWidth: '11rem',
        textAlign: 'right',
      }}>
        {posLabel}
      </span>
    </div>
  );
}
