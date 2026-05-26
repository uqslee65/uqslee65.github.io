import { useState, useEffect } from 'react';

const DISMISS_KEY = 'engagement_dismissed';
const DISMISS_DAYS = 7;
const SHOW_DELAY = 45000;

const contacts = [
  { type: 'LinkedIn', value: 'leeszeray', href: 'https://www.linkedin.com/in/leeszeray/' },
  { type: 'Email', value: 'uqslee65@uq.edu.au', href: 'mailto:uqslee65@uq.edu.au' },
  { type: 'Phone', value: '+61 0493713215', href: 'tel:+610493713215' },
];

export function EngagementPopup() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const elapsed = Date.now() - parseInt(dismissed, 10);
      if (elapsed < DISMISS_DAYS * 86400000) return;
    }
    const timer = setTimeout(() => {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    }, SHOW_DELAY);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setTimeout(() => setMounted(false), 300);
  }

  if (!mounted) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      zIndex: 100,
      maxWidth: '320px',
      width: 'calc(100vw - 3rem)',
      background: '#0a0a0a',
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '1.5rem',
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.24)' }}>
          CONNECT
        </span>
        <button
          onClick={dismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.24)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0 0 0 8px',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.52)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.24)')}
        >
          ✕
        </button>
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '14px', color: 'rgba(255,255,255,0.92)', lineHeight: 1.5 }}>
        Thanks for visiting.<br />
        Have a research idea? Let&apos;s collaborate.
      </div>

      <div style={{
        marginTop: '1rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 0,
      }}>
        {contacts.map(c => (
          <a
            key={c.type}
            href={c.href}
            target={c.type === 'LinkedIn' ? '_blank' : undefined}
            rel={c.type === 'LinkedIn' ? 'noopener' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.52)',
              textDecoration: 'none',
              fontSize: '12px',
              transition: 'color 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.92)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.52)')}
          >
            <span style={{ color: 'rgba(255,255,255,0.24)', fontSize: '13px' }}>&rarr;</span>
            <span style={{ width: '4.5rem', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.24)' }}>
              {c.type}
            </span>
            <span style={{ color: 'inherit' }}>{c.value}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
