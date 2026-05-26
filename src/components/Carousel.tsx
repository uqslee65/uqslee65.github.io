import {
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';

export interface CarouselItem {
  title: string;
  description: string;
  href: string;
  tags: string[];
  status?: 'complete' | 'partial' | 'planned';
}

const STATUS_LABEL: Record<NonNullable<CarouselItem['status']>, string> = {
  complete: 'Complete',
  partial: 'Partial',
  planned: 'Planned',
};

const STATUS_STYLE: Record<
  NonNullable<CarouselItem['status']>,
  { background: string; color: string }
> = {
  complete: {
    background: 'var(--success-bg)',
    color: 'var(--success)',
  },
  partial: {
    background: 'var(--warning-bg)',
    color: 'var(--warning)',
  },
  planned: {
    background: 'var(--accent-light)',
    color: 'var(--accent)',
  },
};

function CarouselCard({ item }: { item: CarouselItem }) {
  const statusStyle = item.status ? STATUS_STYLE[item.status] : null;
  return (
    <a
      href={item.href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
        padding: '1.5rem',
        textDecoration: 'none',
        color: 'inherit',
        flexShrink: 0,
        // width is set by the container's scroll-snap sizing
        width: '100%',
        scrollSnapAlign: 'start',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          'var(--shadow-hover)';
        (e.currentTarget as HTMLAnchorElement).style.transform =
          'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          'var(--shadow)';
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--fg)',
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {item.title}
        </h3>
        {item.status && statusStyle && (
          <span
            style={{
              ...statusStyle,
              fontSize: '0.65rem',
              fontWeight: 600,
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              whiteSpace: 'nowrap',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {STATUS_LABEL[item.status]}
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: '0.85rem',
          color: 'var(--fg-2)',
          lineHeight: 1.5,
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {item.description}
      </p>
      {item.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 'auto' }}>
          {item.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '0.68rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '9999px',
                border: '1px solid var(--border)',
                background: 'var(--stat-bg)',
                color: 'var(--fg-2)',
                fontWeight: 500,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

export default function Carousel({
  items,
  autoAdvanceMs = 5000,
}: {
  items: CarouselItem[];
  autoAdvanceMs?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync dot state on scroll
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const scrollLeft = track.scrollLeft;
    const cardWidth = track.children[0]
      ? (track.children[0] as HTMLElement).offsetWidth
      : track.offsetWidth;
    const gap = 16; // matches gap below
    const idx = Math.round(scrollLeft / (cardWidth + gap));
    setActiveIndex(Math.max(0, Math.min(idx, items.length - 1)));
  }, [items.length]);

  const scrollTo = useCallback((idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[idx] as HTMLElement | undefined;
    if (!child) return;
    track.scrollTo({ left: child.offsetLeft, behavior: 'smooth' });
  }, []);

  // Auto-advance
  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % items.length;
        scrollTo(next);
        return next;
      });
    }, autoAdvanceMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length, autoAdvanceMs, scrollTo]);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Carousel track */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        style={{
          display: 'grid',
          // 1 on mobile, 2 on md, 3 on lg via minmax
          gridAutoFlow: 'column',
          gridAutoColumns: 'clamp(260px, 80vw, 380px)',
          gap: '1rem',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '0.25rem',
        }}
      >
        <style>{`
          [data-carousel-track]::-webkit-scrollbar { display: none; }
        `}</style>
        {items.map((item) => (
          <CarouselCard key={item.href + item.title} item={item} />
        ))}
      </div>

      {/* Dot indicators */}
      {items.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.4rem',
            marginTop: '1rem',
          }}
          role="tablist"
          aria-label="Carousel position"
        >
          {items.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => {
                scrollTo(i);
                setActiveIndex(i);
                pause();
                setTimeout(resume, autoAdvanceMs);
              }}
              style={{
                width: i === activeIndex ? '1.5rem' : '0.5rem',
                height: '0.5rem',
                borderRadius: '9999px',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background:
                  i === activeIndex ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.2s, width 0.25s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
