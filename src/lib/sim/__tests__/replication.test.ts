import { describe, it, expect } from 'vitest';
import { runSession } from '../engine';
import { computeMetrics } from '../metrics';
import { DLM_DEFAULTS, type SimConfig } from '../types';

/**
 * Replication tests for the four conclusions of Dufwenberg, Lindqvist & Moore (2005)
 * and the m0nius extensions, calibrated against the m0nius Plan I 10-session batch export:
 *   per-round mean-abs-deviation  R1 3.65 / R2 2.49 / R3 1.72 / R4 2.28 (50% replacement);
 *   R4-1/3 (replace 2/3) ≈ 2.81; Haessel R² ≈ 0.98–0.99.
 * m0nius is stochastic (no seed), so we assert the pattern + magnitude bands across many
 * seeded sessions, not bit-exact values.
 */

/** Mean abs deviation |meanPrice - fv| for a round, averaged over `n` seeds. */
function avgRoundMAD(round: number, overrides: Partial<SimConfig>, n = 10): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const res = runSession({ ...DLM_DEFAULTS, plan: 'plan-i', seed: 1 + i * 97, ...overrides }, i);
    const ps = res.periods.filter(p => p.round === round);
    total += ps.reduce((s, p) => s + Math.abs(p.meanPrice - p.fv), 0) / ps.length;
  }
  return total / n;
}

function avgRoundR2(round: number, overrides: Partial<SimConfig>, n = 10): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const res = runSession({ ...DLM_DEFAULTS, plan: 'plan-i', seed: 1 + i * 97, ...overrides }, i);
    const ps = res.periods.filter(p => p.round === round);
    total += computeMetrics(ps, DLM_DEFAULTS.fv1, 30).haesselR2;
  }
  return total / n;
}

describe('DLM (2005) replication — the four conclusions (Plan I)', () => {
  it('Point 1: positive mispricing (bubble) decreases as players gain experience (R1 > R2 > R3)', () => {
    const r1 = avgRoundMAD(1, { treatment: 'R4-2/3' });
    const r2 = avgRoundMAD(2, { treatment: 'R4-2/3' });
    const r3 = avgRoundMAD(3, { treatment: 'R4-2/3' });
    expect(r1).toBeGreaterThan(r2);
    expect(r2).toBeGreaterThan(r3);
    // Round-1 bubble lands in the m0nius batch band (~3.4–3.9¢); experienced R3 tracks tightly.
    expect(r1).toBeGreaterThan(2.8);
    expect(r1).toBeLessThan(5.0);
    expect(avgRoundR2(3, { treatment: 'R4-2/3' })).toBeGreaterThan(0.9);
  });

  it('Point 2: a minority of experienced + majority inexperienced does NOT generate a large bubble', () => {
    const r1 = avgRoundMAD(1, { treatment: 'R4-1/3' });
    const r4_minorityExp = avgRoundMAD(4, { treatment: 'R4-1/3' }); // replace 2/3 → 1/3 experienced
    const r4_majorityExp = avgRoundMAD(4, { treatment: 'R4-2/3' }); // replace 1/3 → 2/3 experienced
    // Even with only 1/3 experienced, round-4 mispricing stays well below the round-1 bubble.
    expect(r4_minorityExp).toBeLessThan(r1);
    expect(r4_majorityExp).toBeLessThan(r1);
    // Both replacement treatments produce abated (small) bubbles of comparable size.
    expect(r4_minorityExp).toBeLessThan(r1 * 0.95);
    expect(r4_minorityExp / r4_majorityExp).toBeLessThan(2.2);
  });

  it('Point 3: mispricing depends on the asset type', () => {
    const ld = avgRoundMAD(1, { assetClass: 'linear-declining' });
    const cp = avgRoundMAD(1, { assetClass: 'constant-perpetual' });
    const lg = avgRoundMAD(1, { assetClass: 'linear-growth' });
    // Different asset classes yield materially different round-1 mispricing.
    expect(Math.abs(ld - cp)).toBeGreaterThan(1.0);
    expect(Math.abs(ld - lg)).toBeGreaterThan(1.0);
  });

  it('Point 4: experience does not transfer across (uncorrelated) assets', () => {
    const noSwap = avgRoundMAD(4, { assetClass: 'linear-declining', treatment: 'R4-2/3' });
    const swapLowCorr = avgRoundMAD(4, { assetClass: 'linear-declining', postAssetClass: 'cyclical', treatment: 'R4-2/3' });
    const swapSameAsset = avgRoundMAD(4, { assetClass: 'linear-declining', postAssetClass: 'linear-declining', treatment: 'R4-2/3' });
    // Swapping to a low-correlation asset at the replacement round discounts veterans'
    // experience toward novice, so the round-4 bubble re-appears.
    expect(swapLowCorr).toBeGreaterThan(noSwap * 1.5);
    // Swapping to the SAME asset (|corr| = 1) retains experience → identical to no swap.
    expect(Math.abs(swapSameAsset - noSwap)).toBeLessThan(0.01);
  });

  it('single asset per session: config has no portfolio (assets[]) field', () => {
    const cfg = { ...DLM_DEFAULTS } as Record<string, unknown>;
    expect(cfg.assets).toBeUndefined();
    expect(cfg.assetClass).toBe('linear-declining');
  });
});
