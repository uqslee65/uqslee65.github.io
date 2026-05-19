import { useRef, useEffect } from 'react';
import { useSimulator } from './SimulatorProvider';

// Round colour palette
const ROUND_COLORS: Record<number, string> = {
  1: '#6366f1',
  2: '#f59e0b',
  3: '#22c55e',
  4: '#ef4444',
};

// Inline mini price chart (SVG) — simplified version showing price + FV across periods
function MiniPriceChart({
  periods,
  currentIdx,
}: {
  periods: { meanPrice: number; fv: number }[];
  currentIdx: number;
}) {
  const W = 600;
  const H = 70;
  const pad = { top: 6, right: 12, bottom: 6, left: 30 };
  const w = W - pad.left - pad.right;
  const h = H - pad.top - pad.bottom;

  if (periods.length === 0) {
    // Ghost: flat horizontal line at midpoint with Y-axis labels
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: `${H}px`, opacity: 0.4 }}
        preserveAspectRatio="none"
      >
        {/* Flat midpoint line */}
        <line
          x1={pad.left} x2={W - pad.right}
          y1={H / 2} y2={H / 2}
          stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4,3"
        />
        {/* Y-axis labels */}
        <text x={pad.left - 3} y={pad.top + 6} fontSize="9" fill="#94a3b8" textAnchor="end">
          100
        </text>
        <text x={pad.left - 3} y={pad.top + h} fontSize="9" fill="#94a3b8" textAnchor="end">
          0
        </text>
      </svg>
    );
  }

  const visible = periods.slice(0, currentIdx + 1);
  const allPrices = periods.map(p => p.meanPrice);
  const allFVs = periods.map(p => p.fv);
  const yMin = Math.min(...allPrices, ...allFVs) * 0.85;
  const yMax = Math.max(...allPrices, ...allFVs) * 1.15;

  const xScale = (i: number) =>
    pad.left + (periods.length > 1 ? (i / (periods.length - 1)) * w : w / 2);
  const yScale = (v: number) =>
    pad.top + h - ((v - yMin) / (yMax - yMin)) * h;

  const fvPath = periods.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(p.fv)}`).join(' ');
  const pricePath = visible.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(p.meanPrice)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: `${H}px` }}
      preserveAspectRatio="none"
    >
      {/* FV dashed line */}
      <path d={fvPath} fill="none" stroke="var(--fg-3)" strokeWidth="1.2" strokeDasharray="4,3" />
      {/* Price line */}
      <path d={pricePath} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
      {/* Current dot */}
      {visible.length > 0 && (
        <circle
          cx={xScale(currentIdx)}
          cy={yScale(visible[currentIdx].meanPrice)}
          r="3"
          fill="var(--accent)"
        />
      )}
      {/* Y-axis labels */}
      <text x={pad.left - 3} y={pad.top + 6} fontSize="9" fill="var(--fg-3)" textAnchor="end">
        {Math.round(yMax)}
      </text>
      <text x={pad.left - 3} y={pad.top + h} fontSize="9" fill="var(--fg-3)" textAnchor="end">
        {Math.round(yMin)}
      </text>
    </svg>
  );
}

export function RoundStrip() {
  const { config, activePeriods, activeIdx, seek } = useSimulator();
  const { nRounds, nPeriods } = config;

  // Build per-round arrays
  const rounds = Array.from({ length: nRounds }, (_, r) => r + 1);

  // For mini chart: all periods collapsed into flat array with meanPrice/fv
  const chartData = activePeriods
    ? activePeriods.map(p => ({ meanPrice: p.meanPrice, fv: p.fv }))
    : [];

  const currentGlobalIdx = activeIdx;
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentGlobalIdx]);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '0.5rem 0.75rem',
      marginBottom: '0.75rem',
    }}>
      {/* Period cell strip — one cell per period per round */}
      <div style={{
        overflowX: 'auto',
        display: 'flex',
        gap: '6px',
        paddingBottom: '4px',
        marginBottom: '6px',
      }}>
        {activePeriods && activePeriods.length > 0 ? (
          (() => {
            const groups: { round: number; items: { period: typeof activePeriods[0]; globalIdx: number }[] }[] = [];
            activePeriods.forEach((period, globalIdx) => {
              const last = groups[groups.length - 1];
              if (!last || last.round !== period.round) {
                groups.push({ round: period.round, items: [{ period, globalIdx }] });
              } else {
                last.items.push({ period, globalIdx });
              }
            });

            return groups.map(({ round, items }) => {
              const roundColor = ROUND_COLORS[round] ?? 'var(--accent)';
              return (
                <div key={`group-r${round}`} style={{ display: 'flex', gap: '2px', marginRight: '10px', alignItems: 'center' }}>
                  <div
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: 'white',
                      background: roundColor,
                      borderRadius: '3px',
                      padding: '2px 5px',
                      flexShrink: 0,
                      marginRight: '2px',
                    }}
                  >
                    R{round}
                  </div>
                  {items.map(({ period, globalIdx }) => {
                    const isCurrent = globalIdx === currentGlobalIdx;
                    return (
                      <button
                        key={globalIdx}
                        ref={isCurrent ? activeRef : undefined}
                        onClick={() => seek(globalIdx)}
                        title={`R${period.round} P${period.period}`}
                        style={{
                          flexShrink: 0,
                          width: '36px',
                          height: '24px',
                          border: isCurrent
                            ? `2px solid ${roundColor}`
                            : '1px solid color-mix(in srgb, var(--fg-3) 30%, var(--bg-card))',
                          borderRadius: '5px',
                          background: isCurrent ? roundColor : 'color-mix(in srgb, var(--fg-3) 10%, var(--bg-card))',
                          color: isCurrent ? 'white' : 'var(--fg-3)',
                          fontSize: '0.65rem',
                          fontWeight: isCurrent ? 700 : 400,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.1s',
                        }}
                      >
                        {period.period}
                      </button>
                    );
                  })}
                </div>
              );
            });
          })()
        ) : (
          (() => {
            return rounds.map((round) => {
              const roundColor = ROUND_COLORS[round] ?? 'var(--accent)';
              return (
                <div key={`group-r${round}`} style={{ display: 'flex', gap: '2px', marginRight: '10px', alignItems: 'center' }}>
                  <div
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: 'white',
                      background: roundColor,
                      borderRadius: '3px',
                      padding: '2px 5px',
                      flexShrink: 0,
                      marginRight: '2px',
                    }}
                  >
                    R{round}
                  </div>
                  {Array.from({ length: nPeriods }, (_, i) => (
                    <div
                      key={`placeholder-r${round}-p${i}`}
                      style={{
                        flexShrink: 0,
                        width: '36px',
                        height: '24px',
                        border: '1px dashed color-mix(in srgb, var(--fg-3) 40%, var(--bg-card))',
                        borderRadius: '5px',
                        background: 'color-mix(in srgb, var(--fg-3) 12%, var(--bg-card))',
                      }}
                    />
                  ))}
                </div>
              );
            });
          })()
        )}
      </div>

      {/* Mini price chart */}
      <MiniPriceChart periods={chartData} currentIdx={Math.max(0, currentGlobalIdx)} />
    </div>
  );
}
