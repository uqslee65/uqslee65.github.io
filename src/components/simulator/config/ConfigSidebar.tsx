import { useSimulator } from '../SimulatorProvider';
import { AssetClassSelector } from './AssetClassSelector';
import { TradeSettings } from './TradeSettings';
import { RiskPreferences } from './RiskPreferences';
import { AIEndpoint } from './AIEndpoint';
import { AdvancedSettings } from './AdvancedSettings';
import { PaperConstants } from './PaperConstants';
import { HiddenConstants } from './HiddenConstants';

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
}

function Section({ title, children, defaultOpen = false }: SectionProps) {
  return (
    <details style={detailsStyle} open={defaultOpen}>
      <summary style={summaryStyle}>{title}</summary>
      <div style={bodyStyle}>{children}</div>
    </details>
  );
}

export function ConfigSidebar() {
  const { config } = useSimulator();
  const showAI = config.plan !== 'plan-i';

  return (
    <div>
      <Section title="Asset Class" defaultOpen>
        <AssetClassSelector />
      </Section>
      <Section title="Trade Settings" defaultOpen>
        <TradeSettings />
      </Section>
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
      <Section title="Paper Constants">
        <PaperConstants />
      </Section>
      <Section title="Implementation Constants">
        <HiddenConstants />
      </Section>
    </div>
  );
}
