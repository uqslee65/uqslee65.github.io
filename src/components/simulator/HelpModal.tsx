interface HelpModalProps {
  onClose: () => void;
}

const FIGURES: { num: number; title: string; desc: string }[] = [
  { num: 1,  title: 'Price Chart',            desc: 'Period-by-period trade prices vs. declining fundamental value (FV) line.' },
  { num: 2,  title: 'Signed Mispricing',      desc: '(Price − FV) / FV over time; positive = bubble, negative = underpricing.' },
  { num: 3,  title: 'Volume',                 desc: 'Number of shares traded per period.' },
  { num: 4,  title: 'Density Heatmap',        desc: 'Distribution of trade prices relative to FV across all periods.' },
  { num: 5,  title: 'Action Timeline',        desc: 'Per-agent action sequence (Buy/Sell/Hold/Bid/Ask) over ticks.' },
  { num: 6,  title: 'Subjective Valuation',   desc: 'Each agent\'s belief about asset value compared to FV.' },
  { num: 7,  title: 'Normalised Utility',     desc: 'Agent utility normalised to starting wealth, by risk type.' },
  { num: 8,  title: 'Asset Ownership',        desc: 'Share of total shares held by each agent per period.' },
  { num: 9,  title: 'Broadcast Messages',     desc: 'LLM agent reasoning excerpts shown as a scrolling feed.' },
  { num: 10, title: 'Trust Matrix',           desc: 'Pairwise trust/distrust scores updated after each trade.' },
  { num: 11, title: 'Per-Agent P&L',          desc: 'Cumulative profit-and-loss for each agent across periods.' },
  { num: 12, title: 'Per-Agent Subjective V', desc: 'Agent subjective valuations over time, coloured by risk preference.' },
];

const ASSETS: { name: string; desc: string }[] = [
  { name: 'Linear Declining',   desc: 'Finite life; FV drops linearly as the asset approaches expiry (DLM baseline).' },
  { name: 'Constant Perpetual', desc: 'Infinite life; constant dividend and discount rate → fixed FV = 100¢.' },
  { name: 'Linear Growth',      desc: 'Finite life; expected dividend grows each period, so FV rises before expiry.' },
  { name: 'Cyclical',           desc: 'Finite life; dividend alternates between high and low phases.' },
  { name: 'Random Walk',        desc: 'Finite life; FV follows a random walk — no exploitable trend.' },
  { name: 'Jump-Crash',         desc: 'Finite life; FV is stable until a latent crash event wipes out value.' },
];

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1.25rem 1.5rem',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '0.75rem', right: '0.75rem',
            background: 'transparent', border: 'none',
            color: 'var(--fg-2)', fontSize: '1.1rem', cursor: 'pointer',
            lineHeight: 1, padding: '0.25rem 0.4rem', borderRadius: '4px',
          }}
          aria-label="Close help"
        >
          &times;
        </button>

        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--fg)' }}>
          Simulator Help
        </h2>

        <Section title="Overview">
          <p style={bodyStyle}>
            Agent-based bubble simulation replicating Dufwenberg, Lindqvist &amp; Moore (2005). Tests
            how experience, risk preferences, and belief-update mechanisms affect asset price bubbles.
          </p>
        </Section>

        <Section title="Plans">
          <Row label="Plan I"   text="Algorithmic agents with deterministic belief updates. No API key needed." />
          <Row label="Plan II"  text="LLM agents receive an explicit CRRA utility function. Requires API key." />
          <Row label="Plan III" text="LLM agents receive only a risk-preference label. Requires API key." />
        </Section>

        <Section title="Controls">
          <Row label="Run / Stop"  text="Start a full simulation run or abort mid-run." />
          <Row label="Play / Pause" text="Auto-advance through periods at the configured speed." />
          <Row label="Step"        text="Advance one period at a time." />
          <Row label="Reset"       text="Clear all data and generate a new random seed." />
          <Row label="Speed"       text="Playback interval between period advances (100–1500 ms)." />
          <Row label="Export"      text="Download current session data as JSON (enabled after a run)." />
        </Section>

        <Section title="Figures">
          {FIGURES.map(f => (
            <Row key={f.num} label={`Fig ${f.num}: ${f.title}`} text={f.desc} />
          ))}
        </Section>

        <Section title="Asset Classes">
          {ASSETS.map(a => (
            <Row key={a.name} label={a.name} text={a.desc} />
          ))}
        </Section>

        <Section title="Reference">
          <p style={bodyStyle}>
            Dufwenberg, M., Lindqvist, T., &amp; Moore, E. (2005). Bubbles and Experience: An
            Experiment. <em>American Economic Review</em>, 95(5), 1731–1737.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', marginBottom: '0.4rem' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0 0.75rem', marginBottom: '0.25rem' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: '0.75rem', color: 'var(--fg-2)' }}>{text}</span>
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--fg-2)',
  lineHeight: 1.5,
  margin: 0,
};
