import { useState, useRef, useEffect } from 'react';

const LINKS = [
  { label: 'Work Email', href: 'mailto:uqslee65@uq.edu.au', icon: '✉', sub: 'uqslee65@uq.edu.au' },
  { label: 'Personal Email', href: 'mailto:lszeray@gmail.com', icon: '✉', sub: 'lszeray@gmail.com' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/leeszeray/', icon: 'in', sub: 'leeszeray' },
  { label: 'GitHub', href: 'https://github.com/lszeray', icon: '⌥', sub: 'lszeray' },
];

export function ContactFloat() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 100 }}>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 0.75rem)',
          right: 0,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-hover)',
          padding: '0.75rem 0',
          minWidth: '14rem',
          animation: 'contactSlideUp 0.15s ease-out',
        }}>
          <div style={{ padding: '0 1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Contact
          </div>
          {LINKS.map(link => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith('mailto:') ? undefined : '_blank'}
              rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                color: 'var(--fg)',
                textDecoration: 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--stat-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 700 }}>{link.icon}</span>
              <div>
                <div style={{ fontWeight: 500 }}>{link.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--fg-3)' }}>{link.sub}</div>
              </div>
            </a>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Contact"
        style={{
          width: '3rem',
          height: '3rem',
          borderRadius: '50%',
          background: 'var(--accent)',
          color: 'white',
          border: 'none',
          fontSize: '1.25rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s, background 0.15s',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      >
        {open ? '+' : '✉'}
      </button>
      <style>{`
        @keyframes contactSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
