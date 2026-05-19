interface InfoTipProps {
  text: string;
  children?: React.ReactNode;
}

export function InfoTip({ text, children }: InfoTipProps) {
  return (
    <>
      <span className="sim-infotip" style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'help',
      }}>
        {children ?? (
          <svg width="12" height="12" viewBox="0 0 16 16" style={{ opacity: 0.5 }}>
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <text x="8" y="12" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="700">i</text>
          </svg>
        )}
        <span className="sim-infotip-bubble" style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: 0,
          maxWidth: '260px',
          padding: '0.4rem 0.6rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          fontSize: '0.68rem',
          lineHeight: 1.4,
          color: 'var(--fg-2)',
          whiteSpace: 'normal',
          wordWrap: 'break-word',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 100,
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.15s',
        }}>
          {text}
        </span>
      </span>
      <style>{`
        .sim-infotip:hover .sim-infotip-bubble,
        .sim-infotip:focus-within .sim-infotip-bubble {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </>
  );
}
