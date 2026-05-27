import { useEffect } from 'react';

interface Props {
  message: string;
  onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      right: '1rem',
      maxWidth: '360px',
      padding: '0.75rem 1rem',
      background: 'var(--bg-card)',
      border: '1px solid #ef4444',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
    }}>
      <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>Error</span>
      <p style={{ color: 'var(--fg)', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>{message}</p>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--fg-3)',
          cursor: 'pointer',
          fontSize: '1rem',
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
