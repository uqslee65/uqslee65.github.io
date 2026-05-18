/**
 * Bubble metric computation for the DLM (2005) replication dashboard.
 */

export interface BubbleMetrics {
  haesselR2: number;
  normAbsDev: number;
  normAvgDev: number;
  amplitude: number;
  turnover: number;
}

interface PeriodLike {
  meanPrice: number;
  fv: number;
  trades: unknown[];
}

/**
 * Compute bubble metrics for a sequence of periods within one round.
 *
 * @param periods     Array of period records (from one round, in order)
 * @param fv1         Initial fundamental value — used as normalisation denominator
 * @param totalShares Total share endowment across all agents — used for turnover
 */
export function computeMetrics(
  periods: PeriodLike[],
  fv1: number,
  totalShares: number,
): BubbleMetrics {
  const n = periods.length;
  if (n === 0) return { haesselR2: 0, normAbsDev: 0, normAvgDev: 0, amplitude: 0, turnover: 0 };

  const prices = periods.map(p => p.meanPrice);
  const fvs = periods.map(p => p.fv);

  // Haessel R²: 1 - SSR/SST where SST uses mean of FV
  const meanFV = fvs.reduce((a, b) => a + b, 0) / n;
  const ssr = prices.reduce((sum, p, i) => sum + (p - fvs[i]) ** 2, 0);
  const sst = fvs.reduce((sum, fv) => sum + (fv - meanFV) ** 2, 0);
  const haesselR2 = sst > 0 ? Math.max(0, 1 - ssr / sst) : 0;

  // Normalized absolute deviation (SUM, not mean)
  const normAbsDev = prices.reduce((sum, p, i) => sum + Math.abs(p - fvs[i]), 0) / fv1;

  // Normalized average deviation
  const normAvgDev = (prices.reduce((sum, p, i) => sum + (p - fvs[i]), 0) / n) / fv1;

  // Amplitude
  const deviations = prices.map((p, i) => p - fvs[i]);
  const amplitude = (Math.max(...deviations) - Math.min(...deviations)) / fv1;

  // Turnover (total trades / total shares)
  const totalTrades = periods.reduce((sum, p) => sum + p.trades.length, 0);
  const turnover = totalTrades / totalShares;

  return { haesselR2, normAbsDev, normAvgDev, amplitude, turnover };
}
