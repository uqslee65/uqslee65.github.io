import { useState, useEffect, useRef } from 'react';

export interface DashboardStat {
  value: number;
  label: string;
  icon?: string;
}

const defaultStats: DashboardStat[] = [
  { value: 4,  label: 'Projects' },
  { value: 3,  label: 'Replications' },
  { value: 12, label: 'Papers Read' },
  { value: 1,  label: 'In Progress' },
];

function AnimatedNumber({
  target,
  duration = 1400,
}: {
  target: number;
  duration?: number;
}) {
  const [current, setCurrent] = useState(0);
  const spanRef = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const tick = (now: number) => {
            const raw = Math.min((now - startTime) / duration, 1);
            // cubic ease-out
            const eased = 1 - Math.pow(1 - raw, 3);
            setCurrent(Math.round(eased * target));
            if (raw < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={spanRef}>{current}</span>;
}

export default function DashboardStats({
  stats = defaultStats,
}: {
  stats?: DashboardStat[];
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.75rem',
      }}
      // 4 cols on wider viewports via inline media-equivalent class
      className="dashboard-stats-grid"
    >
      <style>{`
        @media (min-width: 640px) {
          .dashboard-stats-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            padding: '1.25rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '0.375rem',
            transition: 'box-shadow 0.2s, transform 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow =
              'var(--shadow-hover)';
            (e.currentTarget as HTMLDivElement).style.transform =
              'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow =
              'var(--shadow)';
            (e.currentTarget as HTMLDivElement).style.transform =
              'translateY(0)';
          }}
        >
          <span
            style={{
              fontSize: '20px',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <AnimatedNumber target={s.value} />
          </span>
          <span
            style={{
              fontSize: '9px',
              color: 'var(--text-faint)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
