import { type ReactNode } from 'react';
import katex from 'katex';

interface Props {
  figNum: string;
  title: string;
  equation?: string;
  note?: string;
  children: ReactNode;
}

export function Figure({ figNum, title, equation, note, children }: Props) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '0.75rem 1rem',
    }}>
      <div style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        color: 'var(--fg-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.5rem',
      }}>
        <span style={{ color: 'var(--accent)' }}>Fig {figNum}</span>
        {' — '}
        {title}
      </div>

      {children}

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
