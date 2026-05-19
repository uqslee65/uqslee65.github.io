import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import katex from 'katex';

interface Props {
  figNum: string;
  title: string;
  titleTooltip?: string;
  equation?: string;
  note?: string;
  children: ReactNode;
}

export function Figure({ figNum, title, titleTooltip, equation, note, children }: Props) {
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);

  const showTip = useCallback(() => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    setTipPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
  }, []);
  const hideTip = useCallback(() => setTipPos(null), []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const outerStyle: React.CSSProperties = expanded
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        background: 'var(--bg)',
        padding: '1.5rem 2rem',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '0.75rem 1rem',
      };

  return (
    <div style={outerStyle}>
      <div style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        color: 'var(--fg-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}>
        <span style={{ color: 'var(--accent)' }}>Fig {figNum}</span>
        {' — '}
        {title}
        {titleTooltip && (
          <span
            ref={iconRef}
            onMouseEnter={showTip}
            onMouseLeave={hideTip}
            style={{ cursor: 'help', display: 'inline-flex' }}
          >
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '1px solid var(--fg-3)',
              fontSize: '0.55rem',
              color: 'var(--fg-3)',
              lineHeight: 1,
              flexShrink: 0,
            }}>i</span>
          </span>
        )}
        {tipPos && titleTooltip && (
          <div style={{
            position: 'fixed',
            top: tipPos.top,
            left: tipPos.left,
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '0.4rem 0.6rem',
            fontSize: '0.7rem',
            fontWeight: 400,
            color: 'var(--fg)',
            textTransform: 'none',
            letterSpacing: 'normal',
            whiteSpace: 'normal',
            maxWidth: '260px',
            minWidth: '180px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 10000,
            pointerEvents: 'none',
          }}>{titleTooltip}</div>
        )}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-3)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: '3px',
            lineHeight: 1,
            flexShrink: 0,
          }}
          title={expanded ? 'Collapse figure' : 'Expand figure'}
        >
          {expanded ? '✕' : '⤢'}
        </button>
      </div>

      <div style={{
        flex: expanded ? 1 : undefined,
        ...( expanded ? { '--fig-canvas-h': '70vh' } as React.CSSProperties : {}),
      }}>
        {children}
      </div>

      {equation && (
        <details style={{ marginTop: '0.5rem' }}>
          <summary style={{
            fontSize: '0.7rem',
            color: 'var(--fg-3)',
            cursor: 'pointer',
            userSelect: 'none',
          }}>
            Equation
          </summary>
          <div
            style={{ marginTop: '0.35rem', fontSize: '0.85rem', overflowX: 'auto' }}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(equation, { throwOnError: false, displayMode: true }),
            }}
          />
        </details>
      )}

      {note && (
        <p style={{
          marginTop: '0.35rem',
          fontSize: '0.7rem',
          color: 'var(--fg-3)',
          lineHeight: 1.4,
        }}>
          {note}
        </p>
      )}
    </div>
  );
}
