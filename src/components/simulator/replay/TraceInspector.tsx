import { useSimulator } from '../SimulatorProvider';
import type { LLMAgentState } from '../../../lib/sim/types';

// --- Action badge colors ---
const ACTION_COLORS: Record<string, { bg: string; fg: string }> = {
  BUY_NOW: { bg: '#16a34a22', fg: '#16a34a' },
  SELL_NOW: { bg: '#dc262622', fg: '#dc2626' },
  HOLD:    { bg: '#71717a22', fg: '#71717a' },
  BID:     { bg: '#2563eb22', fg: '#2563eb' },
  ASK_1:   { bg: '#ea580c22', fg: '#ea580c' },
};

const ACTION_LABELS: Record<string, string> = {
  BUY_NOW:  'BUY',
  SELL_NOW: 'SELL',
  HOLD:     'HOLD',
  BID:      'BID',
  ASK_1:    'ASK',
};

function ActionPill({ action }: { action: string }) {
  const colors = ACTION_COLORS[action] ?? { bg: '#71717a22', fg: '#71717a' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.1rem 0.45rem',
      borderRadius: '9999px',
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      background: colors.bg,
      color: colors.fg,
    }}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

function isLLMAgent(agent: unknown): agent is LLMAgentState {
  return typeof agent === 'object' && agent !== null && 'riskPref' in agent;
}

function agentLabel(agent: LLMAgentState | { id: number; type: string }): string {
  if (isLLMAgent(agent)) {
    const pref = agent.riskPref === 'risk-averse'
      ? 'Risk-Averse'
      : agent.riskPref === 'risk-loving'
      ? 'Risk-Loving'
      : 'Risk-Neutral';
    return `#${agent.id + 1} ${pref}`;
  }
  const a = agent as { id: number; type: string };
  const typeLabel = a.type === 'fundamentalist'
    ? 'Fundamentalist'
    : a.type === 'trend'
    ? 'Trend-Follower'
    : 'Adaptive';
  return `#${a.id + 1} ${typeLabel}`;
}

export function TraceInspector() {
  const { currentPeriod, activeIdx, isLLM } = useSimulator();

  if (!currentPeriod || activeIdx < 0) {
    return (
      <p style={{ fontSize: '0.75rem', color: 'var(--fg-3)', margin: 0, padding: '0.5rem 0' }}>
        Run simulation and use replay controls to inspect agent decisions
      </p>
    );
  }

  const { agentStates, fv, meanPrice } = currentPeriod;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '0.5rem',
      overflowY: 'auto',
      maxHeight: '280px',
      paddingBottom: '0.25rem',
    }}>
      {agentStates.map((agent) => {
        const llmAgent = isLLMAgent(agent) ? agent : null;
        const wealth = agent.cash + agent.shares * (meanPrice > 0 ? meanPrice : fv);

        return (
          <div
            key={agent.id}
            style={{
              background: 'var(--stat-bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.55rem 0.65rem',
              fontSize: '0.7rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {/* Header row: label + action pill */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '0.72rem' }}>
                {agentLabel(agent as LLMAgentState | { id: number; type: string })}
              </span>
              {llmAgent?.lastAction && <ActionPill action={llmAgent.lastAction} />}
              {!isLLM && (
                <span style={{ fontSize: '0.62rem', color: 'var(--fg-3)' }}>
                  Plan I
                </span>
              )}
            </div>

            {/* State rows */}
            <div style={{ color: 'var(--fg-2)' }}>
              <span style={{ marginRight: '0.6rem' }}>Cash: <b>{agent.cash.toFixed(0)}¢</b></span>
              <span>Shares: <b>{agent.shares}</b></span>
            </div>
            <div style={{ color: 'var(--fg-2)' }}>
              <span style={{ marginRight: '0.6rem' }}>FV: <b>{fv.toFixed(1)}¢</b></span>
              <span>Wealth: <b>{wealth.toFixed(0)}¢</b></span>
            </div>

            {/* LLM-only: reasoning */}
            {'reasoning' in agent && (agent as { reasoning?: string }).reasoning && (
              <div style={{
                marginTop: '0.2rem',
                padding: '0.3rem 0.4rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--fg-3)',
                fontSize: '0.65rem',
                lineHeight: 1.4,
                maxHeight: '3.5rem',
                overflowY: 'auto',
              }}>
                {(agent as { reasoning?: string }).reasoning}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
