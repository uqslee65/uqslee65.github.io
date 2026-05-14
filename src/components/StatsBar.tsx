import { useState, useEffect, useRef } from 'react';

interface Stat {
  value: number;
  label: string;
}

function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref} className="value">{current}</span>;
}

const defaultStats: Stat[] = [
  { value: 4, label: 'Projects' },
  { value: 3, label: 'Replications' },
  { value: 1, label: 'In Progress' },
];

export default function StatsBar({ stats = defaultStats }: { stats?: Stat[] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
      gap: '1rem',
      marginBottom: '2rem',
    }}>
      {stats.map((s) => (
        <div key={s.label} className="stat-chip">
          <AnimatedNumber target={s.value} />
          <div className="label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
