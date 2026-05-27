import type { PeriodRecord } from './engine';
import type { LLMPeriodRecord } from './types';

/**
 * Resolves per-asset data from a period record, falling back to the top-level
 * backward-compat fields (fv, meanPrice, trades) when multi-asset data is absent.
 */
export function resolveAssetData(
  p: PeriodRecord | LLMPeriodRecord,
  assetIdx: number,
) {
  const assetData = 'assets' in p && p.assets?.[assetIdx];
  return {
    fv: assetData ? assetData.fv : p.fv,
    meanPrice: assetData ? assetData.meanPrice : p.meanPrice,
    trades: assetData ? assetData.trades : p.trades,
  };
}
