import { useState, useEffect } from 'react';

const DISMISS_KEY = 'engagement_dismissed';
const DISMISS_DAYS = 7;
const SHOW_DELAY = 300000; // 5 minutes

const contacts = [
  { type: 'LinkedIn', value: 'leeszeray', href: 'https://www.linkedin.com/in/leeszeray/' },
  { type: 'Email', value: 'uqslee65@uq.edu.au', href: 'mailto:uqslee65@uq.edu.au' },
  { type: 'Phone', value: '+61 0493 713 215', href: 'tel:+610493713215' },
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
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-mid)',
      padding: '1.5rem',
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
      fontFamily: "'JetBrains Mono', monospace",
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--text-faint)' }}>
          CONNECT
        </span>
        <button
          onClick={dismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-faint)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0 0 0 8px',
            fontFamily: 'inherit',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '14px', color: 'var(--text)', lineHeight: 1.5 }}>
        Have a research idea?<br />
        Let&apos;s collaborate.
      </div>

      <div style={{
        marginTop: '1rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--border)',
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
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-dim)',
              textDecoration: 'none',
              fontSize: '12px',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ width: '4.5rem', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-faint)' }}>
              {c.type}
            </span>
            <span>{c.value}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
