import { useSimulator } from '../SimulatorProvider';
import { buildPrompt } from '../../../lib/sim/llm-prompts';
import type { LLMAgentState } from '../../../lib/sim/types';

const MOCK_AGENT: LLMAgentState = {
  id: 0,
  riskPref: 'risk-neutral',
  rho: 0,
  cash: 1000,
  shares: 3,
  bias: 0,
  omega: 0.6,
  belief: 75,
  roundsCompleted: 0,
  lastAction: null,
};

const MOCK_CTX = {
  period: 5,
  tick: 1,
  totalPeriods: 20,
  ticksPerPeriod: 18,
  fv: 80,
  bestBid: 77,
  bestAsk: 83,
  lastPrices: [79, 81, 80],
  vwap: 80,
  totalShares: 30,
};

const preStyle: React.CSSProperties = {
  background: 'var(--stat-bg)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  padding: '0.75rem',
  fontSize: '0.68rem',
  color: 'var(--fg-2)',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  lineHeight: 1.5,
  fontFamily: 'monospace',
  maxHeight: '200px',
  overflowY: 'auto',
};

export function PromptEditor() {
  const { config } = useSimulator();
  const plan = config.plan === 'plan-i' ? 'plan-ii' : config.plan;
  const { system, user } = buildPrompt(plan, MOCK_AGENT, MOCK_CTX, config);

  return (
    <div>
      <span style={{
        display: 'inline-block',
        fontSize: '0.65rem',
        fontWeight: 600,
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
        background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))',
        color: 'var(--accent)',
        border: '1px solid color-mix(in srgb, var(--accent) 20%, var(--border))',
        marginBottom: '0.5rem',
      }} title="Prompt editing coming in a future update">
        Read-only preview ({plan === 'plan-ii' ? 'Plan II' : 'Plan III'})
      </span>

      <p style={{ fontSize: '0.72rem', color: 'var(--fg-3)', margin: '0 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        System Prompt
      </p>
      <pre style={preStyle}>{system}</pre>

      <p style={{ fontSize: '0.72rem', color: 'var(--fg-3)', margin: '0.75rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        User Message (sample)
      </p>
      <pre style={preStyle}>{user}</pre>
    </div>
  );
}
