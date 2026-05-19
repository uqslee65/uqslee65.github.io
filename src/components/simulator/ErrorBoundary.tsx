import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; onReset?: () => void; }
interface State { hasError: boolean; message: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid #ef4444',
          borderRadius: 'var(--radius)',
          margin: '1rem',
        }}>
          <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '1rem', margin: '0 0 0.5rem' }}>
            Something went wrong
          </p>
          <p style={{ color: 'var(--fg-2)', fontSize: '0.8rem', margin: '0 0 1rem' }}>
            {this.state.message}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: '' });
              this.props.onReset?.();
            }}
            style={{
              padding: '0.5rem 1.2rem',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'var(--accent)',
              color: 'white',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Reset Simulator
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
