import { useState } from 'react';
import { useSimulator } from './SimulatorProvider';

import { Fig2SignedMispricing } from './figures/Fig2SignedMispricing';
import { Fig3Volume } from './figures/Fig3Volume';
import { Fig4DensityHeatmap } from './figures/Fig4DensityHeatmap';
import { Fig5ActionTimeline } from './figures/Fig5ActionTimeline';
import { Fig6SubjectiveValuation } from './figures/Fig6SubjectiveValuation';
import { Fig7NormalizedUtility } from './figures/Fig7NormalizedUtility';
import { Fig8AssetOwnership } from './figures/Fig8AssetOwnership';
import { Fig9BroadcastMessages } from './figures/Fig9BroadcastMessages';
import { Fig10TrustMatrix } from './figures/Fig10TrustMatrix';
import { Fig11PerAgentPnL } from './figures/Fig11PerAgentPnL';
import { Fig12PerAgentSubjV } from './figures/Fig12PerAgentSubjV';
import { PromptEditor } from './config/PromptEditor';

type TabId = 'market' | 'agents' | 'social';

const TABS: { id: TabId; label: string }[] = [
  { id: 'market', label: 'Market' },
  { id: 'agents', label: 'Agents' },
  { id: 'social', label: 'Social' },
];

const gridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const figWrapStyle: React.CSSProperties = {
  overflow: 'hidden',
};

export function FigureGroups() {
  const { config } = useSimulator();
  const [activeTab, setActiveTab] = useState<TabId>('market');
  const [notes, setNotes] = useState('');

  const plan = config.plan;
  const isPlanI = plan === 'plan-i';
  const isLLM = plan === 'plan-ii' || plan === 'plan-iii';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => {
          const isActive = t.id === activeTab;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1,
                padding: '0.45rem 0.5rem',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--fg-2)',
                fontSize: '0.75rem',
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: '0.75rem' }}>

        {/* Market tab — all plans */}
        {activeTab === 'market' && (
          <div style={gridStyle}>
            <div style={figWrapStyle}><Fig2SignedMispricing /></div>
            <div style={figWrapStyle}><Fig3Volume /></div>
            <div style={figWrapStyle}><Fig4DensityHeatmap /></div>
            <div style={figWrapStyle}><Fig8AssetOwnership /></div>
          </div>
        )}

        {/* Agents tab — all plans; Fig6 and Fig12 are Plan I only */}
        {activeTab === 'agents' && (
          <div style={gridStyle}>
            <div style={figWrapStyle}><Fig5ActionTimeline /></div>
            <div style={figWrapStyle}><Fig7NormalizedUtility /></div>
            <div style={figWrapStyle}><Fig11PerAgentPnL /></div>
            {isPlanI && (
              <div style={figWrapStyle}><Fig6SubjectiveValuation /></div>
            )}
            <div style={figWrapStyle}><Fig12PerAgentSubjV /></div>
          </div>
        )}

        {/* Social tab — content varies by plan */}
        {activeTab === 'social' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* Fig9: Plan I only; Fig10: all plans */}
            <div style={gridStyle}>
              {isPlanI && (
                <div style={figWrapStyle}><Fig9BroadcastMessages /></div>
              )}
              <div style={figWrapStyle}><Fig10TrustMatrix /></div>
            </div>

            {/* PromptEditor: Plan II / III only */}
            {isLLM && (
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
                  <span style={{ color: 'var(--accent)' }}>Prompt</span>
                  {' — '}
                  Agent Prompt Editor
                </div>
                <PromptEditor />
              </div>
            )}

            {/* Empty state for Plan I when no social figures defined yet */}
            {isPlanI && (
              <p style={{
                fontSize: '0.72rem',
                color: 'var(--fg-3)',
                margin: 0,
                padding: '0.4rem 0',
              }}>
                Broadcast and trust data available after running a Plan I session.
              </p>
            )}

            {/* Notes textarea — always visible */}
            <div>
              <p style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--fg-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: '0 0 0.35rem',
              }}>
                Notes
              </p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Your notes..."
                rows={5}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'var(--stat-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--fg)',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  padding: '0.5rem 0.6rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
