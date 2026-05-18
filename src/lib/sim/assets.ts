/**
 * Asset class module — FV computation and dividend generation for 6 asset types.
 *
 * Asset classes:
 *   linear-declining   — SSW/DLM original: FV falls linearly to 0 as dividends run out
 *   constant-perpetual — Gordon growth model at g=0: FV = expectedDiv / discountRate
 *   linear-growth      — Rising FV: FV[t] = fv1 + expectedDiv * (t - 1)
 *   cyclical           — Sinusoidal FV around fv1
 *   random-walk        — Pre-seeded Gaussian random walk; use generateFVPath first
 *   jump-crash         — Pre-seeded drift with 10% crash events; use generateFVPath first
 */

import { PRNG } from './engine';
import type { AssetClass, SimConfig } from './types';

// ---------------------------------------------------------------------------
// Fundamental value
// ---------------------------------------------------------------------------

/**
 * Compute the fundamental value for a given period.
 *
 * For random-walk and jump-crash the caller must pre-generate a path with
 * generateFVPath() and pass it via the optional `fvPath` argument.
 * All other asset classes compute FV analytically and ignore `fvPath`.
 *
 * @param period       1-indexed current period
 * @param totalPeriods total periods in the round (config.nPeriods)
 * @param config       SimConfig
 * @param fvPath       Pre-generated path (required for random-walk / jump-crash)
 */
export function fundamentalValue(
  period: number,
  totalPeriods: number,
  config: Pick<SimConfig, 'assetClass' | 'expectedDiv' | 'discountRate' | 'fv1'>,
  fvPath: number[] = [],
): number {
  const { assetClass, expectedDiv, discountRate, fv1 } = config;

  switch (assetClass) {
    case 'linear-declining':
      // Classic SSW: each period is worth one expected dividend
      return (totalPeriods - period + 1) * expectedDiv;

    case 'constant-perpetual':
      // Gordon growth (g=0): FV = D/r, constant throughout the session
      return expectedDiv / discountRate;

    case 'linear-growth':
      // Rising FV starting at fv1; increases by expectedDiv each period
      return fv1 + expectedDiv * (period - 1);

    case 'cyclical':
      // Sinusoidal oscillation around fv1 with ±40% amplitude
      return fv1 * (1 + 0.4 * Math.sin(2 * Math.PI * (period - 1) / totalPeriods));

    case 'random-walk':
    case 'jump-crash':
      // Path must be pre-generated; fall back to fv1 if path is missing
      return fvPath.length >= period ? fvPath[period - 1] : fv1;

    default: {
      const _exhaustive: never = assetClass;
      return fv1;
    }
  }
}

// ---------------------------------------------------------------------------
// FV path generation (for stochastic asset classes)
// ---------------------------------------------------------------------------

/**
 * Pre-generate the complete FV path for a session.
 *
 * Only meaningful for 'random-walk' and 'jump-crash'; all other asset classes
 * return an empty array because their FVs are computed analytically.
 *
 * Uses a seeded PRNG so the path is deterministic for a given (seed, config).
 *
 * @param seed         Integer seed (e.g. config.seed)
 * @param config       SimConfig (reads nPeriods, fv1, assetClass)
 */
export function generateFVPath(
  seed: number,
  config: Pick<SimConfig, 'assetClass' | 'nPeriods' | 'fv1'>,
): number[] {
  const { assetClass, nPeriods, fv1 } = config;

  if (assetClass !== 'random-walk' && assetClass !== 'jump-crash') {
    return [];
  }

  const rng = new PRNG(seed ^ 0xdeadbeef); // separate stream from the trading PRNG
  const path: number[] = [fv1];

  if (assetClass === 'random-walk') {
    for (let t = 1; t < nPeriods; t++) {
      const prev = path[t - 1];
      const next = prev + rng.normal(0, 5);
      path.push(Math.max(20, next));
    }
  } else {
    // jump-crash: calm drift (+2) with 10% chance of a -30 crash each period
    for (let t = 1; t < nPeriods; t++) {
      const prev = path[t - 1];
      const crashed = rng.next() < 0.10;
      const delta = crashed ? -30 : 2;
      path.push(Math.max(5, prev + delta));
    }
  }

  return path;
}

// ---------------------------------------------------------------------------
// Dividend generation
// ---------------------------------------------------------------------------

/**
 * Draw a dividend for the current period by picking uniformly from
 * config.dividends.  All asset classes use the same mechanism; the
 * asset class only determines FV, not the dividend draw.
 */
export function generateDividend(
  rng: { choice<T>(arr: T[]): T },
  config: Pick<SimConfig, 'dividends'>,
): number {
  return rng.choice(config.dividends as number[]);
}

// ---------------------------------------------------------------------------
// Asset class presets
// ---------------------------------------------------------------------------

/**
 * Partial SimConfig overrides for each asset class.
 * Merge over a base config (e.g. LLM_SCALED_DEFAULTS) to switch asset types.
 *
 * linear-declining uses the LLM-scaled parameterisation (nPeriods=20, div=[0,10])
 * so that all presets are compatible with the same session length.  The classic
 * Plan I 10-period version is encoded in DLM_DEFAULTS in types.ts.
 */
export const ASSET_PRESETS: Record<AssetClass, Partial<Pick<
  SimConfig,
  'dividends' | 'expectedDiv' | 'fv1' | 'nPeriods' | 'discountRate'
>>> = {
  'linear-declining': {
    dividends: [0, 10],
    expectedDiv: 5,
    fv1: 100,
    nPeriods: 20,
    discountRate: 0.05,
  },
  'constant-perpetual': {
    dividends: [4, 6],
    expectedDiv: 5,
    fv1: 100,
    nPeriods: 20,
    discountRate: 0.05,
  },
  'linear-growth': {
    dividends: [0, 10],
    expectedDiv: 5,
    fv1: 60,
    nPeriods: 20,
    discountRate: 0.05,
  },
  cyclical: {
    dividends: [0, 10],
    expectedDiv: 5,
    fv1: 100,
    nPeriods: 20,
    discountRate: 0.05,
  },
  'random-walk': {
    dividends: [0, 10],
    expectedDiv: 5,
    fv1: 100,
    nPeriods: 20,
    discountRate: 0.05,
  },
  'jump-crash': {
    dividends: [0, 10],
    expectedDiv: 5,
    fv1: 100,
    nPeriods: 20,
    discountRate: 0.05,
  },
};
