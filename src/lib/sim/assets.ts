/**
 * Asset class module — FV computation and dividend generation for 6 asset types.
 *
 * Asset classes:
 *   linear-declining   — SSW/DLM original: FV falls linearly to 0 as dividends run out
 *   constant-perpetual — Gordon growth model at g=0: FV = expectedDiv / discountRate
 *   linear-growth      — Gordon perpetuity on rising dividend: FV_t = (a + b*t) / r
 *   cyclical           — Gordon perpetuity on cyclical dividend: FV_t = (5 + 2*sin(2pi(t-1)/10)) / r
 *   random-walk        — Pre-seeded Gaussian random walk; use generateFVPath first
 *   jump-crash         — Pre-seeded drift with 10% crash events; use generateFVPath first
 */

import { PRNG } from './engine';
import type { AssetClass, SimConfig } from './types';

const LG_INTERCEPT = 2;
const LG_SLOPE = 0.3;
const CY_AMPLITUDE = 2;
const CY_CYCLE_LENGTH = 10;

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
      // Gordon perpetuity on rising dividend: FV_t = (a + b*t) / r
      return (LG_INTERCEPT + LG_SLOPE * period) / discountRate;

    case 'cyclical':
      // Gordon perpetuity on cyclical dividend: FV_t = (5 + 2*sin(2pi(t-1)/10)) / r
      return (5 + CY_AMPLITUDE * Math.sin(2 * Math.PI * (period - 1) / CY_CYCLE_LENGTH)) / discountRate;

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
 * Draw a dividend for the current period.
 *
 * linear-declining / constant-perpetual: uniform draw from config.dividends.
 * linear-growth: E[d_t] = a + b*t with Gaussian noise sigma=1.
 * cyclical: E[d_t] = 5 + 2*sin(2pi(t-1)/10) with Gaussian noise sigma=1.
 * random-walk / jump-crash: d_t = FV_t - FV_{t+1}/(1+r), floored at 0.
 */
export function generateDividend(
  rng: { choice<T>(arr: T[]): T; normal(mean: number, std: number): number },
  config: Pick<SimConfig, 'dividends' | 'assetClass' | 'discountRate'>,
  period: number = 1,
  fvPath: number[] = [],
  totalPeriods: number = 20,
): number {
  switch (config.assetClass) {
    case 'linear-declining':
    case 'constant-perpetual':
      return rng.choice(config.dividends as number[]);
    case 'linear-growth':
      return Math.max(0, rng.normal(LG_INTERCEPT + LG_SLOPE * period, 1));
    case 'cyclical':
      return Math.max(0, rng.normal(
        5 + CY_AMPLITUDE * Math.sin(2 * Math.PI * (period - 1) / CY_CYCLE_LENGTH), 1));
    case 'random-walk':
    case 'jump-crash': {
      const fvt = fvPath.length >= period ? fvPath[period - 1] : 100;
      const fvNext = (period < totalPeriods && fvPath.length >= period + 1)
        ? fvPath[period] : 0;
      return Math.max(0, fvt - fvNext / (1 + config.discountRate));
    }
    default:
      return rng.choice(config.dividends as number[]);
  }
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
    expectedDiv: 2.3,
    fv1: 46,
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
