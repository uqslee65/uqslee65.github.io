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
  padding: '0.6rem 0.75rem',
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
  padding: '0 0.75rem 0.75rem',
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

export function ConfigurationPanel() {
  const { config } = useSimulator();
  const showAI = config.plan !== 'plan-i';

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      <Section title="Asset Class" defaultOpen>
        <AssetClassSelector />
      </Section>
      <Section title="Trade Settings">
        <TradeSettings />
      </Section>
      <Section title="Risk Preferences">
        <RiskPreferences />
      </Section>
      {showAI && (
        <Section title="AI Endpoint">
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
