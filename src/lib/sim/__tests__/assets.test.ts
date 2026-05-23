import { describe, it, expect } from 'vitest';
import {
  fundamentalValue,
  generateFVPath,
  generateDividend,
  ASSET_PRESETS,
} from '../assets';
import { PRNG } from '../engine';
import { DLM_DEFAULTS, type AssetClass } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal config by spreading DLM_DEFAULTS with an assetClass override. */
function cfg(assetClass: AssetClass, overrides?: Partial<typeof DLM_DEFAULTS>) {
  return { ...DLM_DEFAULTS, assetClass, ...overrides };
}

/** Identity-based mock RNG: choice returns first element, normal returns mean. */
const mockRng = {
  choice: <T>(arr: T[]): T => arr[0],
  normal: (mean: number, _std: number): number => mean,
};

const ALL_ASSET_CLASSES: AssetClass[] = [
  'linear-declining',
  'constant-perpetual',
  'linear-growth',
  'cyclical',
  'random-walk',
  'jump-crash',
];

// ---------------------------------------------------------------------------
// 1. fundamentalValue — linear-declining at t=1, t=10, t=20 (T=20, E[d]=5)
// ---------------------------------------------------------------------------

describe('fundamentalValue: linear-declining', () => {
  const config = cfg('linear-declining', { expectedDiv: 5, nPeriods: 20 });

  it('returns 100 at t=1  (T=20, E[d]=5  →  (20-1+1)*5=100)', () => {
    expect(fundamentalValue(1, 20, config)).toBe(100);
  });

  it('returns 55 at t=10  (T=20, E[d]=5  →  (20-10+1)*5=55)', () => {
    expect(fundamentalValue(10, 20, config)).toBe(55);
  });

  it('returns 5 at t=20   (T=20, E[d]=5  →  (20-20+1)*5=5)', () => {
    expect(fundamentalValue(20, 20, config)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 2. fundamentalValue — constant-perpetual → expectedDiv / discountRate
// ---------------------------------------------------------------------------

describe('fundamentalValue: constant-perpetual', () => {
  it('returns 100 when expectedDiv=5, discountRate=0.05', () => {
    const config = cfg('constant-perpetual', { expectedDiv: 5, discountRate: 0.05 });
    expect(fundamentalValue(1, 20, config)).toBeCloseTo(100, 10);
  });

  it('returns expectedDiv/discountRate for arbitrary values', () => {
    const config = cfg('constant-perpetual', { expectedDiv: 3, discountRate: 0.03 });
    expect(fundamentalValue(7, 20, config)).toBeCloseTo(3 / 0.03, 10);
  });
});

// ---------------------------------------------------------------------------
// 3. fundamentalValue for each of the 6 asset classes at t=1 → finite & positive
// ---------------------------------------------------------------------------

describe('fundamentalValue: all asset classes at t=1 are finite and positive', () => {
  for (const assetClass of ALL_ASSET_CLASSES) {
    it(`${assetClass} produces a positive, non-NaN FV at t=1`, () => {
      const config = cfg(assetClass);
      // For stochastic classes supply a minimal fvPath anchored to fv1=100.
      const fvPath = assetClass === 'random-walk' || assetClass === 'jump-crash'
        ? [config.fv1]
        : [];
      const fv = fundamentalValue(1, config.nPeriods, config, fvPath);
      expect(Number.isNaN(fv)).toBe(false);
      expect(fv).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. generateFVPath — random-walk returns an array of length nPeriods, all > 0
// ---------------------------------------------------------------------------

describe('generateFVPath: random-walk', () => {
  const config = cfg('random-walk', { nPeriods: 20, fv1: 100 });

  it('returns an array whose length equals nPeriods', () => {
    const path = generateFVPath(42, config);
    expect(path).toHaveLength(config.nPeriods);
  });

  it('every element in the path is positive', () => {
    const path = generateFVPath(42, config);
    for (const v of path) {
      expect(v).toBeGreaterThan(0);
    }
  });

  it('first element equals fv1', () => {
    const path = generateFVPath(42, config);
    expect(path[0]).toBe(config.fv1);
  });
});

// ---------------------------------------------------------------------------
// 5. generateFVPath — linear-declining returns an empty array
// ---------------------------------------------------------------------------

describe('generateFVPath: linear-declining', () => {
  it('returns [] because FV is computed analytically', () => {
    const config = cfg('linear-declining', { nPeriods: 20, fv1: 100 });
    expect(generateFVPath(42, config)).toEqual([]);
  });

  it('returns [] for constant-perpetual (analytical)', () => {
    const config = cfg('constant-perpetual');
    expect(generateFVPath(42, config)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. generateDividend — linear-declining returns one of the dividend values
// ---------------------------------------------------------------------------

describe('generateDividend: linear-declining', () => {
  const config = cfg('linear-declining', { dividends: [0, 10] as const });

  it('returns a value drawn from config.dividends', () => {
    const rng = new PRNG(42);
    const div = generateDividend(rng, config, 1, [], 20);
    expect(config.dividends).toContain(div);
  });

  it('mockRng.choice(arr) → first element: returns dividends[0]', () => {
    const div = generateDividend(mockRng, config, 1, [], 20);
    expect(div).toBe(config.dividends[0]); // arr[0] = 0
  });
});

// ---------------------------------------------------------------------------
// 7. ASSET_PRESETS — all 6 entries exist with fv1 > 0
// ---------------------------------------------------------------------------

describe('ASSET_PRESETS', () => {
  it('contains an entry for every AssetClass', () => {
    for (const assetClass of ALL_ASSET_CLASSES) {
      expect(ASSET_PRESETS).toHaveProperty(assetClass);
    }
  });

  it('every preset has fv1 > 0', () => {
    for (const assetClass of ALL_ASSET_CLASSES) {
      const preset = ASSET_PRESETS[assetClass];
      expect(preset.fv1).toBeDefined();
      expect(preset.fv1!).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Seed determinism: generateFVPath with same seed → identical arrays
// ---------------------------------------------------------------------------

describe('generateFVPath: seed determinism', () => {
  it('random-walk: same seed produces identical paths', () => {
    const config = cfg('random-walk', { nPeriods: 20, fv1: 100 });
    const pathA = generateFVPath(99, config);
    const pathB = generateFVPath(99, config);
    expect(pathA).toEqual(pathB);
  });

  it('jump-crash: same seed produces identical paths', () => {
    const config = cfg('jump-crash', { nPeriods: 20, fv1: 100 });
    const pathA = generateFVPath(7, config);
    const pathB = generateFVPath(7, config);
    expect(pathA).toEqual(pathB);
  });

  it('different seeds produce different paths (probabilistic sanity check)', () => {
    const config = cfg('random-walk', { nPeriods: 20, fv1: 100 });
    const pathA = generateFVPath(1, config);
    const pathB = generateFVPath(2, config);
    expect(pathA).not.toEqual(pathB);
  });
});
