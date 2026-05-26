import { useState, useRef, useEffect } from 'react';

export interface GitHubActivityProps {
  /** 52 weeks × 7 days (Sun→Sat), values 0–4. Pass null/undefined for placeholder. */
  data?: number[][] | null;
}

const WEEKS = 52;
const DAYS = 7; // Sun=0 … Sat=6
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const CELL = 11; // px
const GAP = 2;   // px

// Generate stable seeded pseudo-random placeholder data
function seededPlaceholder(): number[][] {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };
  return Array.from({ length: WEEKS }, () =>
    Array.from({ length: DAYS }, () => {
      const r = rand();
      // Mostly 0 with sparse 1-2, rare 3-4
      if (r < 0.6) return 0;
      if (r < 0.8) return 1;
      if (r < 0.92) return 2;
      if (r < 0.97) return 3;
      return 4;
    })
  );
}

// Build a week→month label map for the top axis
function buildMonthLabels(weeks: number[][]): { weekIdx: number; label: string }[] {
  const labels: { weekIdx: number; label: string }[] = [];
  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  let lastMonth = -1;
  const now = Date.now();
  for (let w = 0; w < weeks.length; w++) {
    // Approximate date for this week column (going back from today)
    const weekStart = new Date(
      now - (weeks.length - 1 - w) * 7 * 24 * 60 * 60 * 1000
    );
    const month = weekStart.getMonth();
    if (month !== lastMonth) {
      labels.push({ weekIdx: w, label: MONTH_NAMES[month] });
      lastMonth = month;
    }
  }
  return labels;
}

interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

export default function GitHubActivity({ data }: GitHubActivityProps) {
  const displayData = data && data.length ? data : seededPlaceholder();
  const monthLabels = buildMonthLabels(displayData);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    text: '',
    x: 0,
    y: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to end (most recent) on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, []);

  const cellColor = (level: number): string => {
    const levels = [
      'rgba(255,255,255,0.04)',
      '#0e4429',
      '#006d32',
      '#26a641',
      '#39d353',
    ];
    return levels[level] ?? levels[0];
  };

  const showTooltip = (
    e: React.MouseEvent,
    weekIdx: number,
    dayIdx: number,
    count: number
  ) => {
    const now = Date.now();
    const weekStart = new Date(
      now - (displayData.length - 1 - weekIdx) * 7 * 24 * 60 * 60 * 1000
    );
    // Offset to exact day
    weekStart.setDate(weekStart.getDate() + dayIdx - weekStart.getDay());
    const dateStr = weekStart.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    setTooltip({
      visible: true,
      text: `${count} commit${count !== 1 ? 's' : ''} — ${dateStr}`,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 36,
    });
  };

  const hideTooltip = () => setTooltip((t) => ({ ...t, visible: false }));

  const gridWidth = displayData.length * (CELL + GAP) - GAP;
  const gridHeight = DAYS * (CELL + GAP) - GAP;

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          overflowX: 'auto',
          background: 'var(--bg-raised)',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--border) transparent',
          paddingBottom: '0.25rem',
        }}
      >
        {/* Tooltip */}
        {tooltip.visible && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x,
              top: tooltip.y,
              background: 'rgba(255,255,255,0.92)',
              color: '#000',
              fontSize: '0.72rem',
              padding: '0.3rem 0.6rem',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
              transform: 'translateX(-50%)',
              boxShadow: 'var(--shadow-hover)',
            }}
          >
            {tooltip.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          {/* Day-of-week labels */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${GAP}px`,
              paddingTop: '1.25rem', // align with grid rows below month labels
              flexShrink: 0,
            }}
          >
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                style={{
                  height: `${CELL}px`,
                  fontSize: '10px',
                  color: 'var(--text-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '4px',
                  width: '2rem',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Main grid + month labels */}
          <div>
            {/* Month label row */}
            <div
              style={{
                position: 'relative',
                height: '1.1rem',
                width: `${gridWidth}px`,
                marginBottom: '2px',
              }}
            >
              {monthLabels.map(({ weekIdx, label }) => (
                <span
                  key={weekIdx}
                  style={{
                    position: 'absolute',
                    left: `${weekIdx * (CELL + GAP)}px`,
                    fontSize: '10px',
                    color: 'var(--text-faint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Cell grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${displayData.length}, ${CELL}px)`,
                gridTemplateRows: `repeat(${DAYS}, ${CELL}px)`,
                gap: `${GAP}px`,
                width: `${gridWidth}px`,
                height: `${gridHeight}px`,
              }}
            >
              {displayData.map((week, wi) =>
                week.map((count, di) => (
                  <div
                    key={`${wi}-${di}`}
                    style={{
                      width: `${CELL}px`,
                      height: `${CELL}px`,
                      background: cellColor(count),
                      border: count === 0 ? '1px solid var(--border)' : 'none',
                      cursor: 'default',
                      transition: 'opacity 0.15s',
                      gridColumn: wi + 1,
                      gridRow: di + 1,
                    }}
                    onMouseEnter={(e) => showTooltip(e, wi, di, count)}
                    onMouseLeave={hideTooltip}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
