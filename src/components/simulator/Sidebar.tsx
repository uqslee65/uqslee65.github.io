import { useState } from 'react';
import { useSimulator } from './SimulatorProvider';
import { MetricsPanel } from './MetricsPanel';
import { AgentsPanel } from './agents/AgentsPanel';
import { OrderBookPanel } from './orderbook/OrderBookPanel';
import { ReplayPanel } from './replay/ReplayPanel';
import { ConfigSidebar } from './config/ConfigSidebar';

function TradeFeed({ trades }: { trades: { buyer: number; seller: number; price: number; tick: number }[] }) {
  const recent = trades.slice(-12).reverse();
  return (
    <div style={{ padding: '0.5rem 0' }}>
      {recent.length === 0 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--fg-3)', margin: 0 }}>No trades yet</p>
      )}
      {recent.map((t, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          padding: '0.15rem 0',
          borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{t.price.toFixed(1)}c</span>
          <span style={{ color: 'var(--fg-3)' }}>A{t.buyer + 1} &larr; A{t.seller + 1}</span>
          <span style={{ color: 'var(--fg-3)', fontSize: '0.65rem' }}>t{t.tick}</span>
        </div>
      ))}
    </div>
  );
}

function CollapsibleSection({ title, defaultOpen = false, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} style={{ borderBottom: '1px solid var(--border)' }}>
      <summary style={{
        padding: '0.5rem 0.6rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--fg)',
        cursor: 'pointer',
        userSelect: 'none',
        listStyle: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}>
        {title}
      </summary>
      <div style={{ padding: '0 0.6rem 0.6rem' }}>
        {children}
      </div>
    </details>
  );
}

export function SidebarContent() {
  const { currentPeriod } = useSimulator();

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Context zone */}
      <div style={{ borderBottom: '2px solid var(--border)' }}>
        <div style={{ padding: '0.5rem 0.6rem' }}>
          <MetricsPanel />
        </div>

        <CollapsibleSection title="Agents" defaultOpen>
          <AgentsPanel />
        </CollapsibleSection>

        <CollapsibleSection title="Order Book">
          <OrderBookPanel />
        </CollapsibleSection>

        <CollapsibleSection title="Trade Feed">
          {currentPeriod ? (
            <TradeFeed trades={currentPeriod.trades} />
          ) : (
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-3)', margin: 0 }}>
              Run the simulation to see trades.
            </p>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Replay">
          <ReplayPanel />
        </CollapsibleSection>
      </div>

      {/* Config zone */}
      <ConfigSidebar />
    </div>
  );
}

export function Sidebar() {
  return (
    <aside style={{
      width: '280px',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
    }}>
      <SidebarContent />
    </aside>
  );
}
