import { useSimulator } from '../SimulatorProvider';

interface OrderRow {
  price: number;
  qty: number;
  agent: number;
}

function colHead(label: string) {
  return (
    <th style={{
      padding: '0.25rem 0.4rem',
      fontSize: '0.65rem',
      fontWeight: 700,
      color: 'var(--fg-3)',
      textAlign: 'left',
      borderBottom: '1px solid var(--border)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </th>
  );
}

function OrderSide({
  rows, side,
}: { rows: OrderRow[]; side: 'bid' | 'ask' }) {
  const isBid = side === 'bid';
  const bg = isBid
    ? 'color-mix(in srgb, #22c55e 8%, var(--bg-card))'
    : 'color-mix(in srgb, #ef4444 8%, var(--bg-card))';
  const accent = isBid ? '#22c55e' : '#ef4444';

  return (
    <div style={{ flex: 1, background: bg, borderRadius: '6px', overflow: 'hidden' }}>
      <div style={{
        padding: '0.3rem 0.5rem',
        fontSize: '0.7rem', fontWeight: 700,
        color: accent,
        borderBottom: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        {isBid ? 'BIDS' : 'ASKS'}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '0.5rem', fontSize: '0.7rem', color: 'var(--fg-3)', textAlign: 'center' }}>
          —
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {colHead('Price')}
              {colHead('Qty')}
              {colHead('Agent')}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', fontWeight: 700, color: accent }}>
                  {r.price.toFixed(1)}
                </td>
                <td style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', color: 'var(--fg-2)' }}>
                  {r.qty}
                </td>
                <td style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', color: 'var(--fg-3)' }}>
                  A{r.agent + 1}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function OrderBookPanel() {
  const { currentPeriod } = useSimulator();

  // No persistent order book in the data model — show live trade prices when running
  const recentTrades = currentPeriod?.trades.slice(-5) ?? [];

  // Synthesize illustrative bid/ask rows from recent trade prices
  const bids: OrderRow[] = recentTrades.slice().reverse().slice(0, 4).map((t, i) => ({
    price: t.price - (i + 1) * 0.5,
    qty: 1,
    agent: t.buyer,
  }));
  const asks: OrderRow[] = recentTrades.slice().reverse().slice(0, 4).map((t, i) => ({
    price: t.price + (i + 1) * 0.5,
    qty: 1,
    agent: t.seller,
  }));

  const hasData = recentTrades.length > 0;
  const spread = hasData && asks.length > 0 && bids.length > 0
    ? (asks[0].price - bids[0].price).toFixed(2)
    : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <OrderSide rows={bids} side="bid" />

        {/* Spread */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '0 0.25rem', gap: '0.25rem',
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--fg-3)' }}>spread</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg-2)' }}>
            {spread ?? '—'}
          </div>
        </div>

        <OrderSide rows={asks} side="ask" />
      </div>

      {hasData && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--fg-3)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Activity
          </div>
          {recentTrades.slice().reverse().map((t, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '0.7rem', padding: '0.15rem 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{t.price.toFixed(1)}c</span>
              <span style={{ color: 'var(--fg-3)' }}>A{t.buyer + 1} &larr; A{t.seller + 1}</span>
              <span style={{ color: 'var(--fg-3)', fontSize: '0.65rem' }}>t{t.tick}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
