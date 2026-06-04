import type { PeriodRecord } from './engine';
import type { LLMPeriodRecord } from './types';

/**
 * Returns the top-level fv/meanPrice/trades from a period record.
 * The assetIdx param is accepted but ignored — records are single-asset only.
 */
export function resolveAssetData(
  p: PeriodRecord | LLMPeriodRecord,
  _assetIdx?: number,
) {
  return {
    fv: p.fv,
    meanPrice: p.meanPrice,
    trades: p.trades,
  };
}
