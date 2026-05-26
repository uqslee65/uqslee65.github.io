import { useState, useEffect, useRef } from 'react';

export interface CarouselItem {
  title: string;
  description: string;
  href: string;
}

export interface CarouselProps {
  items: CarouselItem[];
  intervalMs?: number;
}

export function Carousel({ items, intervalMs = 6000 }: CarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      if (!pausedRef.current) {
        setActiveIndex((prev) => (prev + 1) % items.length);
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [items.length, intervalMs]);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <style>{`
        .carousel-wrapper {
          position: relative;
          width: 100%;
          height: 120px;
          border: 1px solid rgba(255,255,255,0.08);
          background: #0a0a0a;
        }
        @media (max-width: 640px) {
          .carousel-wrapper {
            height: auto !important;
          }
          .carousel-card {
            flex-direction: column !important;
            position: relative !important;
            inset: unset !important;
          }
          .carousel-card[data-inactive="true"] {
            display: none !important;
          }
          .carousel-left {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            padding: 1.5rem 2rem 1rem !important;
          }
          .carousel-right {
            width: 100% !important;
            padding: 1rem 2rem 1.5rem !important;
          }
        }
      `}</style>
      <div
        className="carousel-wrapper"
        onMouseEnter={pause}
        onMouseLeave={resume}
      >
        {items.map((item, i) => (
          <a
            key={item.href + item.title}
            href={item.href}
            className="carousel-card"
            data-inactive={i !== activeIndex ? 'true' : undefined}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'row',
              textDecoration: 'none',
              color: 'inherit',
              opacity: i === activeIndex ? 1 : 0,
              transition: 'opacity 400ms ease',
              pointerEvents: i === activeIndex ? 'auto' : 'none',
            }}
          >
            {/* Left side */}
            <div
              className="carousel-left"
              style={{
                width: '40%',
                padding: '2rem',
                display: 'flex',
                alignItems: 'center',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.92)',
                  lineHeight: 1.3,
                }}
              >
                {item.title}
              </span>
            </div>
            {/* Right side */}
            <div
              className="carousel-right"
              style={{
                width: '60%',
                padding: '2rem',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.52)',
                  lineHeight: 1.6,
                }}
              >
                {item.description}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* Indicators */}
      {items.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {items.map((_, i) => (
            <div
              key={i}
              onClick={() => {
                setActiveIndex(i);
                pausedRef.current = true;
                setTimeout(() => { pausedRef.current = false; }, intervalMs);
              }}
              style={{
                width: '24px',
                height: '2px',
                background: i === activeIndex ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.12)',
                cursor: 'pointer',
                transition: 'background 300ms ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Carousel;
