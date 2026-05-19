import { useState } from 'react';
import { useSimulator } from '../SimulatorProvider';
import { PlanSelector } from '../PlanSelector';
import { AssetClassSelector } from './AssetClassSelector';
import { TradeSettings } from './TradeSettings';
import { RiskPreferences } from './RiskPreferences';
import { AIEndpoint } from './AIEndpoint';
import { AdvancedSettings } from './AdvancedSettings';
import { PaperConstants } from './PaperConstants';
import { HiddenConstants } from './HiddenConstants';
import { TOOLTIPS } from '../../../lib/sim/tooltips';

const detailsStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
};

const summaryStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: 'var(--fg)',
  cursor: 'pointer',
  userSelect: 'none',
  listStyle: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
};

const bodyStyle: React.CSSProperties = {
  padding: '0 0.6rem 0.6rem',
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  tooltip?: string;
}

function Section({ title, children, defaultOpen = false, tooltip }: SectionProps) {
  return (
    <details style={detailsStyle} open={defaultOpen}>
      <summary style={summaryStyle} title={tooltip}>{title}</summary>
      <div style={bodyStyle}>{children}</div>
    </details>
  );
}

export function ConfigSidebar() {
  const { config } = useSimulator();
  const [expertMode, setExpertMode] = useState(false);
  const showAI = config.plan !== 'plan-i';

  return (
    <div>
      {/* Plan selector + expert toggle header */}
      <div style={{ padding: '0.6rem' }}>
        <PlanSelector />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.4rem 0',
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--fg-2)' }}>Expert mode</span>
          <button
            onClick={() => setExpertMode(m => !m)}
            style={{
              width: '36px',
              height: '20px',
              borderRadius: '10px',
              border: 'none',
              background: expertMode ? 'var(--accent)' : 'var(--border)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute',
              top: '2px',
              left: expertMode ? '18px' : '2px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>

      <Section title="Asset Class" defaultOpen>
        <AssetClassSelector />
      </Section>
      <Section title="Trade Settings" defaultOpen>
        <TradeSettings compact={!expertMode} />
      </Section>
      {expertMode && (
        <>
          <Section title="Risk Preferences" defaultOpen>
            <RiskPreferences />
          </Section>
          {showAI && (
            <Section title="AI Endpoint" defaultOpen>
              <AIEndpoint />
            </Section>
          )}
          <Section title="Advanced Settings">
            <AdvancedSettings />
          </Section>
          <Section title="Paper Constants" tooltip={TOOLTIPS['constants.paper']}>
            <PaperConstants />
          </Section>
          <Section title="Implementation Constants" tooltip={TOOLTIPS['constants.impl']}>
            <HiddenConstants />
          </Section>
        </>
      )}
    </div>
  );
}
