import { useState } from 'react';
import type { PeriodRecord, AgentType } from '../../../lib/sim/engine';
import type { LLMAgentState, LLMPeriodRecord } from '../../../lib/sim/types';

type PlanIState = PeriodRecord['agentStates'][0];

interface SparklineProps {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}

function Sparkline({ values, color, width = 80, height = 24 }: SparklineProps) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 2) + 1;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface AgentCardProps {
  id: number;
  isLLM: boolean;
  planIState?: PlanIState;
  llmState?: LLMAgentState;
  fv: number;
  // Historical data for sparklines
  cashHistory: number[];
  sharesHistory: number[];
  priceHistory: number[]; // for wealth = cash + shares * price
  sharesHistoryForWealth: number[];
}

const TYPE_COLORS: Record<AgentType, string> = {
  speculator: '#ef4444',
  moderate: '#f59e0b',
  aware: '#22c55e',
  fundamentalist: '#3b82f6',
  'trend-follower': '#a855f7',
};

const PREF_COLORS: Record<string, string> = {
  'risk-loving': '#ef4444',
  'risk-neutral': '#f59e0b',
  'risk-averse': '#22c55e',
};

const ACTION_COLORS: Record<string, string> = {
  BUY_NOW: '#22c55e',
  BID: '#86efac',
  SELL_NOW: '#ef4444',
  ASK_1: '#fca5a5',
  HOLD: '#6b7280',
};

export function AgentCard({
  id, isLLM, planIState, llmState, fv,
  cashHistory, sharesHistory, priceHistory, sharesHistoryForWealth,
}: AgentCardProps) {
  const [flipped, setFlipped] = useState(false);

  const borderColor = isLLM && llmState
    ? (PREF_COLORS[llmState.riskPref] ?? 'var(--border)')
    : (!isLLM && planIState
        ? (TYPE_COLORS[planIState.type] ?? 'var(--border)')
        : 'var(--border)');

  const cash = isLLM ? (llmState?.cash ?? 0) : (planIState?.cash ?? 0);
  const shares = isLLM ? (llmState?.shares ?? 0) : (planIState?.shares ?? 0);
  const belief = isLLM ? (llmState?.belief ?? 0) : (planIState?.belief ?? 0);
  const mispricing = fv > 0 ? ((belief - fv) / fv * 100).toFixed(1) : '0.0';
  const mispricingNum = parseFloat(mispricing);
  const lastAction = isLLM ? llmState?.lastAction : null;

  const typeLabel = isLLM && llmState
    ? ({ 'risk-loving': 'Risk-Loving', 'risk-neutral': 'Risk-Neutral', 'risk-averse': 'Risk-Averse' }[llmState.riskPref] ?? '?')
    : (!isLLM && planIState
        ? ({ speculator: 'Speculator', moderate: 'Moderate', aware: 'Aware', fundamentalist: 'Fundamentalist', 'trend-follower': 'Trend-Follower' }[planIState.type] ?? '?')
        : '?');

  // Wealth history
  const wealthHistory = priceHistory.map((p, i) =>
    (cashHistory[i] ?? cash) + (sharesHistoryForWealth[i] ?? shares) * p
  );

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    minHeight: '110px',
    perspective: '600px',
  };

  const faceBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    padding: '0.5rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderLeft: `3px solid ${borderColor}`,
    borderRadius: '6px',
    fontSize: '0.7rem',
    backfaceVisibility: 'hidden',
    transition: 'transform 0.35s ease',
    overflowY: 'auto',
  };

  return (
    <div style={cardStyle} onClick={() => setFlipped(f => !f)}>
      {/* Front */}
      <div style={{
        ...faceBase,
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <span style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '0.75rem' }}>
            #{id + 1}
          </span>
          <span style={{
            fontSize: '0.6rem', fontWeight: 600,
            color: mispricingNum > 0 ? '#ef4444' : '#22c55e',
          }}>
            {mispricingNum > 0 ? '+' : ''}{mispricing}%
          </span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--fg-3)', marginBottom: '0.3rem' }}>
          {typeLabel}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--fg-2)', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
          <span>{Math.round(cash)}c</span>
          <span>{shares}sh</span>
        </div>
        {lastAction && (
          <span style={{
            display: 'inline-block',
            fontSize: '0.6rem', fontWeight: 700,
            padding: '0.1rem 0.3rem',
            borderRadius: '3px',
            background: ACTION_COLORS[lastAction] ?? '#6b7280',
            color: '#fff',
          }}>
            {lastAction}
          </span>
        )}
        <div style={{ fontSize: '0.7rem', color: 'var(--fg-3)', marginTop: '0.4rem', textAlign: 'right' }} title="Tap to flip">
          ↻
        </div>
      </div>

      {/* Back */}
      <div style={{
        ...faceBase,
        transform: flipped ? 'rotateY(0deg)' : 'rotateY(-180deg)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        justifyContent: 'center',
      }}>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--fg-3)', marginBottom: '0.15rem' }}>Cash</div>
          <Sparkline values={cashHistory.length > 1 ? cashHistory : [cash]} color="#60a5fa" />
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--fg-3)', marginBottom: '0.15rem' }}>Shares</div>
          <Sparkline values={sharesHistory.length > 1 ? sharesHistory : [shares]} color="#a78bfa" />
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--fg-3)', marginBottom: '0.15rem' }}>Wealth</div>
          <Sparkline values={wealthHistory.length > 1 ? wealthHistory : [cash + shares * fv]} color="#34d399" />
        </div>
      </div>
    </div>
  );
}
