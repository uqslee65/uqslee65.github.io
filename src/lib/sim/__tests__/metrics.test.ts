import { describe, it, expect } from 'vitest';
import { computeMetrics } from '../metrics';

const p = (meanPrice: number, fv: number, trades: unknown[] = []) => ({ meanPrice, fv, trades });

describe('computeMetrics', () => {
  it('returns all zeros for empty periods', () => {
    const result = computeMetrics([], 100, 30);
    expect(result).toEqual({ haesselR2: 0, normAbsDev: 0, normAvgDev: 0, amplitude: 0, turnover: 0 });
  });

  it('computes correct metrics for 3-period hand-computed case', () => {
    // prices=[120,90,60], fvs=[100,95,90], fv1=100, totalShares=30
    // deviations: [20, -5, -30]
    // meanFV = 95, SSR = 400+25+900 = 1325, SST = 25+0+25 = 50
    // haesselR2 = max(0, 1 - 1325/50) = 0
    // NAD = (20+5+30)/100 = 0.55
    // normAvgDev = ((20-5-30)/3)/100 = -0.05
    // amplitude = (20 - (-30))/100 = 0.5
    // turnover = 0/30 = 0
    const periods = [p(120, 100), p(90, 95), p(60, 90)];
    const result = computeMetrics(periods, 100, 30);
    expect(result.haesselR2).toBe(0);
    expect(result.normAbsDev).toBeCloseTo(0.55, 10);
    expect(result.normAvgDev).toBeCloseTo(-0.05, 10);
    expect(result.amplitude).toBeCloseTo(0.5, 10);
    expect(result.turnover).toBe(0);
  });

  it('returns haesselR2≈1, NAD=0, amplitude=0 when all prices equal FV', () => {
    const periods = [p(100, 100), p(80, 80), p(60, 60)];
    const result = computeMetrics(periods, 100, 10);
    expect(result.haesselR2).toBeCloseTo(1, 10);
    expect(result.normAbsDev).toBe(0);
    expect(result.normAvgDev).toBe(0);
    expect(result.amplitude).toBe(0);
  });

  it('handles a single period without dividing by zero', () => {
    const result = computeMetrics([p(110, 100)], 100, 5);
    expect(Number.isFinite(result.haesselR2)).toBe(true);
    expect(Number.isFinite(result.normAbsDev)).toBe(true);
    expect(Number.isFinite(result.normAvgDev)).toBe(true);
    expect(Number.isFinite(result.amplitude)).toBe(true);
    expect(Number.isFinite(result.turnover)).toBe(true);
    // single period: SST=0 → haesselR2=0; deviation=10
    expect(result.haesselR2).toBe(0);
    expect(result.normAbsDev).toBeCloseTo(0.1, 10);
    expect(result.normAvgDev).toBeCloseTo(0.1, 10);
    expect(result.amplitude).toBe(0);
  });

  it('returns haesselR2=0 when all FVs are identical (SST=0)', () => {
    const periods = [p(120, 100), p(90, 100), p(60, 100)];
    const result = computeMetrics(periods, 100, 30);
    expect(result.haesselR2).toBe(0);
  });
});
