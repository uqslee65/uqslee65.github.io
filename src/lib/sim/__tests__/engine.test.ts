import { describe, it, expect } from 'vitest';
import { PRNG, OrderBook, Agent, runSession, DLM_DEFAULTS } from '../engine';
import { computeMetrics } from '../metrics';
import type { AssetClass } from '../types';

describe('PRNG', () => {
  it('determinism: same seed produces same sequence', () => {
    const a = new PRNG(42);
    const b = new PRNG(42);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('uniform(0,1): min near 0, max near 1, mean near 0.5', () => {
    const rng = new PRNG(99);
    const draws = Array.from({ length: 1000 }, () => rng.uniform(0, 1));
    const min = Math.min(...draws);
    const max = Math.max(...draws);
    const mean = draws.reduce((s, x) => s + x, 0) / draws.length;
    expect(min).toBeLessThan(0.05);
    expect(max).toBeGreaterThan(0.95);
    expect(mean).toBeCloseTo(0.5, 1);
  });
});

describe('OrderBook', () => {
  it('matching: bid=50 ask=45 produces 1 trade at 47.5', () => {
    const book = new OrderBook();
    const agents = [
      new Agent(0, 1000, 5, 0, 'utility'),
      new Agent(1, 1000, 5, 0, 'utility'),
    ];
    book.submitBid(50, 0);
    book.submitAsk(45, 1);
    const trades = book.match(agents, 0);
    expect(trades).toHaveLength(1);
    expect(trades[0].price).toBe(47.5);
    expect(trades[0].buyer).toBe(0);
    expect(trades[0].seller).toBe(1);
  });

  it('no match: bid=40 ask=50 produces no trades', () => {
    const book = new OrderBook();
    const agents = [
      new Agent(0, 1000, 5, 0, 'utility'),
      new Agent(1, 1000, 5, 0, 'utility'),
    ];
    book.submitBid(40, 0);
    book.submitAsk(50, 1);
    const trades = book.match(agents, 0);
    expect(trades).toHaveLength(0);
  });
});

describe('runSession', () => {
  it('round count: nRounds=2 nPeriods=3 → 6 period records', () => {
    const result = runSession({ ...DLM_DEFAULTS, nRounds: 2, nPeriods: 3 });
    expect(result.periods).toHaveLength(6);
  });

  it('round field: periods have correct round values', () => {
    const result = runSession({ ...DLM_DEFAULTS, nRounds: 2, nPeriods: 3 });
    const rounds = result.periods.map(p => p.round);
    expect(rounds).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it('FV resets at round boundary: linear-declining period 20 FV=5, next round period 1 FV=100', () => {
    const result = runSession({ ...DLM_DEFAULTS, nRounds: 2, nPeriods: 20 });
    const r1last = result.periods.find(p => p.round === 1 && p.period === 20)!;
    const r2first = result.periods.find(p => p.round === 2 && p.period === 1)!;
    expect(r1last.fv).toBe(5);
    expect(r2first.fv).toBe(100);
  });

  it('seed determinism: same seed → identical price sequences', () => {
    const r1 = runSession(DLM_DEFAULTS, 1);
    const r2 = runSession(DLM_DEFAULTS, 1);
    const prices1 = r1.periods.map(p => p.meanPrice);
    const prices2 = r2.periods.map(p => p.meanPrice);
    expect(prices1).toEqual(prices2);
  });

  it('round 4 replacement: some agents have different rho than round 3', () => {
    const result = runSession({ ...DLM_DEFAULTS, nRounds: 4 }, 1);
    const r3last = result.periods.filter(p => p.round === 3).at(-1)!;
    const r4first = result.periods.find(p => p.round === 4)!;
    const rhos3 = r3last.agentStates.map(a => a.rho);
    const rhos4 = r4first.agentStates.map(a => a.rho);
    const changed = rhos3.filter((r, i) => r !== rhos4[i]).length;
    expect(changed).toBeGreaterThanOrEqual(1);
  });

  it('bounded rationality sigma: completes and prices differ from default', () => {
    const brConfig = { enabled: true, K: 5, N: 5, T: 3, sigma: 50, p: 0 };
    const base = runSession({ ...DLM_DEFAULTS, seed: 7, boundedRationality: { ...DLM_DEFAULTS.boundedRationality, enabled: false } });
    const br = runSession({ ...DLM_DEFAULTS, seed: 7, boundedRationality: brConfig });
    expect(br.periods).toHaveLength(base.periods.length);
    const basePrices = base.periods.map(p => p.meanPrice);
    const brPrices = br.periods.map(p => p.meanPrice);
    expect(brPrices).not.toEqual(basePrices);
  });

  it('bounded rationality p=1: completes and metrics differ from p=0', () => {
    const brP0 = runSession({ ...DLM_DEFAULTS, seed: 7, boundedRationality: { enabled: true, K: 5, N: 5, T: 3, sigma: 0, p: 0 } });
    const brP1 = runSession({ ...DLM_DEFAULTS, seed: 7, boundedRationality: { enabled: true, K: 5, N: 5, T: 3, sigma: 0, p: 1.0 } });
    expect(brP1.periods).toHaveLength(brP0.periods.length);
    const prices0 = brP0.periods.map(p => p.meanPrice);
    const prices1 = brP1.periods.map(p => p.meanPrice);
    expect(prices1).not.toEqual(prices0);
  });

  it('regulator circuit breaker: fewer trades than default when threshold is very tight', () => {
    const seed = 42;
    const base = runSession({ ...DLM_DEFAULTS, seed, regulator: { enabled: false, threshold: 0.5 } });
    const reg = runSession({ ...DLM_DEFAULTS, seed, regulator: { enabled: true, threshold: 0.01 } });
    const baseTrades = base.periods.reduce((s, p) => s + p.trades.length, 0);
    const regTrades = reg.periods.reduce((s, p) => s + p.trades.length, 0);
    expect(regTrades).toBeLessThan(baseTrades);
  });
});

describe('asset class integration', () => {
  const classes: AssetClass[] = [
    'linear-declining', 'constant-perpetual', 'linear-growth',
    'cyclical', 'random-walk', 'jump-crash',
  ];

  for (const ac of classes) {
    it(`${ac}: runs to completion without error`, () => {
      const result = runSession({
        ...DLM_DEFAULTS, assetClass: ac, nRounds: 1, nPeriods: 5, seed: 42,
      });
      expect(result.periods).toHaveLength(5);
      expect(result.periods.every(p => p.fv > 0)).toBe(true);
      expect(result.periods.every(p => isFinite(p.meanPrice))).toBe(true);
    });
  }

  it('linear-declining FV trends down, constant-perpetual is flat', () => {
    const ld = runSession({ ...DLM_DEFAULTS, assetClass: 'linear-declining', nRounds: 1, nPeriods: 10 });
    const cp = runSession({ ...DLM_DEFAULTS, assetClass: 'constant-perpetual', nRounds: 1, nPeriods: 10 });
    expect(ld.periods[0].fv).toBeGreaterThan(ld.periods[9].fv);
    expect(cp.periods[0].fv).toBe(cp.periods[9].fv);
  });
});

describe('DLM theoretical patterns (seed=42)', () => {
  it('learning improves then replacement disrupts: R1<R2<R3 R², R4 disrupted', () => {
    const result = runSession({ ...DLM_DEFAULTS, seed: 42 }, 1);
    const periods = result.periods;
    const totalShares = periods[0].agentStates.reduce((s, a) => s + a.shares, 0);
    const metrics = [1, 2, 3, 4].map(r => {
      const rp = periods.filter(p => p.round === r);
      return computeMetrics(rp, DLM_DEFAULTS.fv1, totalShares);
    });
    const [m1, m2, m3, m4] = metrics;
    // Point 1: positive mispricing (bubble) shrinks as experience accumulates R1 -> R3.
    expect(m1.haesselR2).toBeLessThan(m2.haesselR2);
    expect(m2.haesselR2).toBeLessThan(m3.haesselR2);
    expect(m1.normAbsDev).toBeGreaterThan(m3.normAbsDev);
    // Experienced market tracks fundamentals tightly (m0nius batch R3 R^2 ~ 0.98).
    expect(m3.haesselR2).toBeGreaterThan(0.9);
    // Replacement round re-introduces novices and disrupts R4 relative to R3.
    expect(m4.haesselR2).toBeLessThan(m3.haesselR2);
    expect(m4.normAbsDev).toBeGreaterThan(m3.normAbsDev);
  });
});
