/**
 * TypeScript port of the DLM (2005) bubble simulation engine.
 * Client-side CDA with heterogeneous agents producing bubble-crash dynamics.
 */

import { fundamentalValue as computeFV, generateDividend, generateFVPath } from './assets';
import { DLM_DEFAULTS, type SimConfig, type ExperienceCurveConfig, type HeuristicWeights, type RiskPreference, type BoundedRationalityConfig } from './types';

// --- Legacy constant exports (kept for back-compat; values come from DLM_DEFAULTS) ---

export const N_ROUNDS = DLM_DEFAULTS.nRounds;
export const N_PERIODS = DLM_DEFAULTS.nPeriods;
export const TICKS_PER_PERIOD = DLM_DEFAULTS.ticksPerPeriod;
export const DIVIDENDS = DLM_DEFAULTS.dividends;
export const FV_1 = DLM_DEFAULTS.fv1;

// Re-export DLM_DEFAULTS so call sites can build configs without importing types directly
export { DLM_DEFAULTS } from './types';

const P_FILL_PASSIVE = 0.30;

function sampleRho(pref: RiskPreference, rng: PRNG): number {
  switch (pref) {
    case 'risk-loving': return rng.uniform(-0.9, -0.1);
    case 'risk-neutral': return 0;
    case 'risk-averse': return rng.uniform(0.1, 0.9);
  }
}

function assignRiskPreference(
  i: number, nAgents: number, riskSplit: [number, number, number],
): RiskPreference {
  const fraction = i / nAgents;
  if (fraction < riskSplit[0]) return 'risk-loving';
  if (fraction < riskSplit[0] + riskSplit[1]) return 'risk-neutral';
  return 'risk-averse';
}

// --- PRNG (seeded xoshiro128**) ---

export class PRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6D2B79F5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  normal(mean: number, std: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }

  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  permutation(n: number): number[] {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  choiceN(n: number, k: number): number[] {
    const perm = this.permutation(n);
    return perm.slice(0, k);
  }
}

// --- Order Book ---

interface Order {
  price: number;
  agentId: number;
}

export interface Trade {
  buyer: number;
  seller: number;
  price: number;
  tick: number;
  assetIdx?: number;  // which asset this trade was for
}

export interface AssetPeriodData {
  assetId: string;  // string to avoid importing AssetClass here
  fv: number;
  meanPrice: number;
  trades: Trade[];
}

export class OrderBook {
  bids: Order[] = [];
  asks: Order[] = [];

  submitBid(price: number, agentId: number) {
    this.bids.push({ price, agentId });
    this.bids.sort((a, b) => b.price - a.price);
  }

  submitAsk(price: number, agentId: number) {
    this.asks.push({ price, agentId });
    this.asks.sort((a, b) => a.price - b.price);
  }

  match(agents: Agent[], tick: number, assetIdx: number = 0): Trade[] {
    const trades: Trade[] = [];
    while (this.bids.length > 0 && this.asks.length > 0) {
      const bestBid = this.bids[0];
      const bestAsk = this.asks[0];
      if (bestBid.price < bestAsk.price) break;
      this.bids.shift();
      this.asks.shift();
      if (bestBid.agentId === bestAsk.agentId) continue;
      const buyer = agents[bestBid.agentId];
      const seller = agents[bestAsk.agentId];
      const tradePrice = (bestBid.price + bestAsk.price) / 2;
      if (buyer.cash < tradePrice || seller.sharesPerAsset[assetIdx] < 1) continue;
      buyer.cash -= tradePrice;
      buyer.sharesPerAsset[assetIdx] += 1;
      seller.cash += tradePrice;
      seller.sharesPerAsset[assetIdx] -= 1;
      trades.push({ buyer: bestBid.agentId, seller: bestAsk.agentId, price: tradePrice, tick, assetIdx });
    }
    return trades;
  }

  get bestBidPrice(): number | null {
    return this.bids.length > 0 ? this.bids[0].price : null;
  }

  get bestAskPrice(): number | null {
    return this.asks.length > 0 ? this.asks[0].price : null;
  }
}

// --- Agent ---

export type AgentType = 'utility' | 'fundamentalist' | 'trend-follower';

export class Agent {
  id: number;
  cash: number;
  sharesPerAsset: number[];  // multi-asset share counts; index 0 = primary asset
  beliefBias: number;
  belief: number;
  roundsCompleted: number;
  type: AgentType;
  rho: number;
  riskPref: RiskPreference;

  private fv1: number;

  // Backward-compat accessors — all existing callers using .shares continue to work
  get shares(): number { return this.sharesPerAsset[0]; }
  set shares(v: number) { this.sharesPerAsset[0] = v; }

  constructor(
    id: number, cash: number, shares: number,
    beliefBias: number, type: AgentType,
    fv1: number = FV_1,
    riskPref: RiskPreference = 'risk-neutral',
    rho: number = 0,
    nAssets: number = 1,
  ) {
    this.id = id;
    this.cash = cash;
    this.sharesPerAsset = new Array(nAssets).fill(0);
    this.sharesPerAsset[0] = shares;  // first asset gets the endowed shares
    this.beliefBias = beliefBias;
    this.fv1 = fv1;
    this.belief = fv1 * (1 + beliefBias);
    this.roundsCompleted = 0;
    this.type = type;
    this.riskPref = riskPref;
    this.rho = rho;
  }

  crraUtility(w: number): number {
    const safeW = Math.max(w, 0.01);
    if (Math.abs(this.rho - 1) < 0.001) return Math.log(safeW);
    return Math.pow(safeW, 1 - this.rho) / (1 - this.rho);
  }

  get isExperienced(): boolean {
    return this.roundsCompleted > 0;
  }

  valuation(
    fv: number, period: number, rng: PRNG,
    exp: ExperienceCurveConfig, heuristics: HeuristicWeights,
    lastPrice: number, prevPrice: number, lastDividend: number,
    discountRate: number, priorBias: boolean, priorNoise: boolean, vwap: number,
    br?: BoundedRationalityConfig,
  ): number {
    const effectiveRC = br?.enabled ? Math.min(this.roundsCompleted, br.T) : this.roundsCompleted;

    const perceivedFV = br?.enabled ? Math.max(0, fv + rng.normal(0, br.sigma)) : fv;

    const alpha_i = this.type === 'fundamentalist' ? 1.0
      : this.type === 'trend-follower' ? 0.0
      : Math.min(1, exp.alpha0 + exp.gammaAlpha * effectiveRC);
    const sigma_i = exp.sigma0 * Math.exp(-exp.gammaSigma * effectiveRC);
    const omega_i = Math.min(1.0, exp.omega0 + exp.deltaOmega * Math.min(exp.kMax, effectiveRC));
    const H = this.heuristic(heuristics, lastPrice, prevPrice, lastDividend, perceivedFV, discountRate);
    const blend = alpha_i * perceivedFV + (1 - alpha_i) * H;
    const bias = priorBias ? this.beliefBias : 0;
    const noise = priorNoise ? rng.normal(0, sigma_i) : 0;
    const V_prior = Math.max(0, blend * (1 + bias) + noise);
    const peerSignal = vwap > 0 ? vwap : perceivedFV;

    return Math.max(1.0, omega_i * V_prior + (1 - omega_i) * peerSignal);
  }

  maybeSubmit(
    fv: number, lastPrice: number, period: number, book: OrderBook, rng: PRNG,
    config: SimConfig, prevPrice: number, lastDividend: number, vwap: number,
  ) {
    const br = config.boundedRationality;
    const v = this.valuation(fv, period, rng, config.experience, config.heuristics,
      lastPrice, prevPrice, lastDividend, config.discountRate,
      config.priorBias, config.priorNoise, vwap, br);

    // N limits order book visibility
    const bestBid = br?.enabled && br.N === 0 ? null : book.bestBidPrice;
    const bestAsk = br?.enabled && br.N === 0 ? null : book.bestAskPrice;
    const w0 = this.cash + this.shares * v;
    const U0 = this.crraUtility(w0);

    type Action = { name: string; eu: number; submit: () => void };
    const actions: Action[] = [];

    // HOLD — baseline (always included)
    actions.push({ name: 'hold', eu: U0, submit: () => {} });

    // BUY_NOW — market buy at best ask (p_fill = 1.0)
    if (bestAsk !== null && this.cash >= bestAsk) {
      const w1 = (this.cash - bestAsk) + (this.shares + 1) * v;
      actions.push({
        name: 'buy_now', eu: this.crraUtility(w1),
        submit: () => book.submitBid(bestAsk + 0.01, this.id),
      });
    }

    // SELL_NOW — market sell at best bid (p_fill = 1.0)
    if (bestBid !== null && this.shares > 0) {
      const w1 = (this.cash + bestBid) + (this.shares - 1) * v;
      actions.push({
        name: 'sell_now', eu: this.crraUtility(w1),
        submit: () => book.submitAsk(bestBid - 0.01, this.id),
      });
    }

    // PASSIVE BID — limit buy improving the bid (p_fill = P_FILL_PASSIVE)
    const bidPrice = bestBid !== null ? bestBid + 0.5 : fv * 0.95;
    if (bidPrice > 0 && bidPrice <= this.cash) {
      const w1 = (this.cash - bidPrice) + (this.shares + 1) * v;
      const eu = P_FILL_PASSIVE * this.crraUtility(w1) + (1 - P_FILL_PASSIVE) * U0;
      actions.push({
        name: 'bid', eu,
        submit: () => book.submitBid(bidPrice, this.id),
      });
    }

    // PASSIVE ASK — limit sell improving the ask (p_fill = P_FILL_PASSIVE)
    const askPrice = bestAsk !== null ? bestAsk - 0.5 : fv * 1.05;
    if (askPrice > 0 && this.shares > 0) {
      const w1 = (this.cash + askPrice) + (this.shares - 1) * v;
      const eu = P_FILL_PASSIVE * this.crraUtility(w1) + (1 - P_FILL_PASSIVE) * U0;
      actions.push({
        name: 'ask', eu,
        submit: () => book.submitAsk(askPrice, this.id),
      });
    }

    // K limits action evaluation: keep HOLD + randomly sample min(K-1, rest)
    let candidates = actions;
    if (br?.enabled && br.K < actions.length) {
      const nonHold = actions.slice(1);
      const k = Math.min(br.K - 1, nonHold.length);
      const indices = rng.choiceN(nonHold.length, k);
      candidates = [actions[0], ...indices.map(i => nonHold[i])];
    }

    // Argmax with tie-breaking noise
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].eu > best.eu + rng.normal(0, 0.001)) best = candidates[i];
    }

    // p — execution error: with probability p, pick random action instead
    if (br?.enabled && br.p > 0 && rng.next() < br.p) {
      const validActions = candidates.filter(a => a.name !== 'hold');
      if (validActions.length > 0) {
        best = rng.choice(validActions);
      }
    }

    best.submit();
  }

  /**
   * Multi-asset EU argmax. Called when nAssets > 1.
   * Agent picks ONE action across ALL assets per tick (shared cash = capital constraint).
   *
   * NOTE: wealthWith uses fvs[j] (true FV) as the mark-to-market price for each asset,
   * while valuation() is still called per-asset to advance the RNG consistently with the
   * single-asset path. If subjective valuation should drive wealth calc, replace fvs[j]
   * with v in the wealthWith lambda — confirm with spec author.
   */
  maybeSubmitMulti(
    fvs: number[], lastPrices: number[], period: number, books: OrderBook[], rng: PRNG,
    config: SimConfig, prevPrices: number[], lastDividends: number[], vwaps: number[],
  ) {
    const br = config.boundedRationality;
    const nAssets = books.length;

    // Total wealth across all assets (marked at true FV)
    let totalWealth = this.cash;
    for (let j = 0; j < nAssets; j++) {
      totalWealth += this.sharesPerAsset[j] * fvs[j];
    }
    const U0 = this.crraUtility(totalWealth);

    type MultiAction = { name: string; eu: number; assetIdx: number; submit: () => void };
    const actions: MultiAction[] = [];

    // HOLD — always available (asset-agnostic)
    actions.push({ name: 'hold', eu: U0, assetIdx: -1, submit: () => {} });

    for (let j = 0; j < nAssets; j++) {
      // Call valuation() per asset to advance RNG consistently with single-asset path
      this.valuation(fvs[j], period, rng, config.experience, config.heuristics,
        lastPrices[j], prevPrices[j], lastDividends[j], config.discountRate,
        config.priorBias, config.priorNoise, vwaps[j], br);

      const bestBid = br?.enabled && br.N === 0 ? null : books[j].bestBidPrice;
      const bestAsk = br?.enabled && br.N === 0 ? null : books[j].bestAskPrice;

      // Wealth if action succeeds — adjust only asset j's shares, all else unchanged
      const wealthWith = (deltaCash: number, deltaShares: number) => {
        let w = this.cash + deltaCash;
        for (let k = 0; k < nAssets; k++) {
          const s = this.sharesPerAsset[k] + (k === j ? deltaShares : 0);
          w += s * fvs[k];
        }
        return w;
      };

      // BUY_NOW
      if (bestAsk !== null && this.cash >= bestAsk) {
        const w1 = wealthWith(-bestAsk, 1);
        actions.push({
          name: 'buy_now', eu: this.crraUtility(w1), assetIdx: j,
          submit: () => books[j].submitBid(bestAsk + 0.01, this.id),
        });
      }

      // SELL_NOW
      if (bestBid !== null && this.sharesPerAsset[j] > 0) {
        const w1 = wealthWith(bestBid, -1);
        actions.push({
          name: 'sell_now', eu: this.crraUtility(w1), assetIdx: j,
          submit: () => books[j].submitAsk(bestBid - 0.01, this.id),
        });
      }

      // PASSIVE BID
      const bidPrice = bestBid !== null ? bestBid + 0.5 : fvs[j] * 0.95;
      if (bidPrice > 0 && bidPrice <= this.cash) {
        const w1 = wealthWith(-bidPrice, 1);
        const eu = P_FILL_PASSIVE * this.crraUtility(w1) + (1 - P_FILL_PASSIVE) * U0;
        actions.push({
          name: 'bid', eu, assetIdx: j,
          submit: () => books[j].submitBid(bidPrice, this.id),
        });
      }

      // PASSIVE ASK
      const askPrice = bestAsk !== null ? bestAsk - 0.5 : fvs[j] * 1.05;
      if (askPrice > 0 && this.sharesPerAsset[j] > 0) {
        const w1 = wealthWith(askPrice, -1);
        const eu = P_FILL_PASSIVE * this.crraUtility(w1) + (1 - P_FILL_PASSIVE) * U0;
        actions.push({
          name: 'ask', eu, assetIdx: j,
          submit: () => books[j].submitAsk(askPrice, this.id),
        });
      }
    }

    // K-limit + argmax + execution error (same logic as maybeSubmit)
    let candidates = actions;
    if (br?.enabled && br.K < actions.length) {
      const nonHold = actions.slice(1);
      const k = Math.min(br.K - 1, nonHold.length);
      const indices = rng.choiceN(nonHold.length, k);
      candidates = [actions[0], ...indices.map(i => nonHold[i])];
    }

    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].eu > best.eu + rng.normal(0, 0.001)) best = candidates[i];
    }

    if (br?.enabled && br.p > 0 && rng.next() < br.p) {
      const validActions = candidates.filter(a => a.name !== 'hold');
      if (validActions.length > 0) best = rng.choice(validActions);
    }

    best.submit();
  }

  learn() {
    this.roundsCompleted++;
  }

  resetBelief() {
    const bias = this.roundsCompleted === 0 ? this.beliefBias : 0;
    this.belief = this.fv1 * (1 + bias);
  }

  experienceAlpha(exp: ExperienceCurveConfig): number {
    return Math.min(1, exp.alpha0 + exp.gammaAlpha * this.roundsCompleted);
  }

  experienceNoise(exp: ExperienceCurveConfig): number {
    return exp.sigma0 * Math.exp(-exp.gammaSigma * this.roundsCompleted);
  }

  experienceOmega(exp: ExperienceCurveConfig): number {
    return Math.min(1.0, exp.omega0 + exp.deltaOmega * Math.min(exp.kMax, this.roundsCompleted));
  }

  heuristic(
    weights: HeuristicWeights,
    lastPrice: number, prevPrice: number,
    lastDividend: number, fv: number, discountRate: number,
  ): number {
    const anchor = lastPrice > 0 ? lastPrice : this.belief;
    const trend = this.belief + (lastPrice - prevPrice);
    const divSignal = discountRate > 0 ? lastDividend / discountRate : lastDividend * 20;
    const narrative = fv * (1 + this.beliefBias);
    return weights.anchor * anchor + weights.trend * trend
         + weights.dividend * divSignal + weights.narrative * narrative;
  }
}

// --- Factory ---

function generateEndowment(rng: PRNG, config: SimConfig): { cash: number; sharesPerAsset: number[] } {
  const [minCash, maxCash] = config.endowmentCash;
  const cash = Math.round(rng.uniform(minCash, maxCash));
  const nAssets = config.assets?.length ?? 1;
  const sharesPerAsset = new Array(nAssets).fill(0);
  for (let j = 0; j < nAssets; j++) {
    const weight = config.assets?.[j]?.weight ?? 1;
    const pool = config.endowmentShares;
    const baseShares = pool[Math.floor(rng.next() * pool.length)];
    sharesPerAsset[j] = nAssets === 1 ? baseShares : Math.max(1, Math.round(baseShares * weight));
  }
  return { cash, sharesPerAsset };
}

function makeAgent(
  id: number,
  endow: { cash: number; sharesPerAsset: number[] },
  rng: PRNG,
  fv1: number,
  riskPref: RiskPreference,
): Agent {
  const biasDir = rng.next() < 0.33 ? 1 : rng.next() < 0.5 ? -1 : 0;
  const bias = biasDir * 0.15;
  const nAssets = endow.sharesPerAsset.length;
  const agent = new Agent(
    id, endow.cash, endow.sharesPerAsset[0],
    bias, 'utility',
    fv1, riskPref, sampleRho(riskPref, rng),
    nAssets,
  );
  // Copy remaining asset shares (index 0 already set by constructor)
  for (let j = 1; j < nAssets; j++) {
    agent.sharesPerAsset[j] = endow.sharesPerAsset[j];
  }
  return agent;
}

// --- Simulation state (for incremental stepping) ---

export interface PeriodRecord {
  round: number;
  period: number;
  fv: number;           // backward-compat: always assets[0].fv
  meanPrice: number;    // backward-compat: always assets[0].meanPrice
  trades: Trade[];      // backward-compat: always assets[0].trades
  agentStates: { id: number; belief: number; cash: number; shares: number; type: AgentType; rho: number; riskPref: RiskPreference }[];
  assets?: AssetPeriodData[];  // per-asset data (populated when nAssets > 1)
}

export interface SessionResult {
  sessionId: number;
  treatment: string;
  periods: PeriodRecord[];
}

/**
 * Compute the fundamental value for a given period.
 * Delegates to assets.ts; exported so callers don't need a separate import.
 * The legacy 0-arg override is available via DLM_DEFAULTS for back-compat.
 */
export function fundamentalValue(
  period: number,
  totalPeriods: number = N_PERIODS,
  config: Parameters<typeof computeFV>[2] = DLM_DEFAULTS,
  fvPath: number[] = [],
): number {
  return computeFV(period, totalPeriods, config, fvPath);
}

// --- Full simulation runner ---

/**
 * Run one round of CDA trading, returning one PeriodRecord per period.
 *
 * @param agents     Mutable agent array (updated in-place)
 * @param roundNum   1-indexed round number (recorded in output)
 * @param rng        Seeded PRNG
 * @param config     SimConfig — reads nPeriods, ticksPerPeriod, nAgents, fv1, assetClass
 * @param fvPath     Pre-generated FV path for asset 0 (single-asset backward compat)
 * @param fvPaths    Pre-generated FV paths per asset (multi-asset; overrides fvPath when provided)
 */
export function runRound(
  agents: Agent[],
  roundNum: number,
  rng: PRNG,
  config: SimConfig = DLM_DEFAULTS,
  fvPath: number[] = [],
  fvPaths?: number[][],
): PeriodRecord[] {
  const { nPeriods, ticksPerPeriod, fv1 } = config;
  const nAgents = agents.length;
  // For single-asset, assetClass is the canonical field; assets[] is only authoritative for nAssets > 1.
  const rawAssetConfigs = config.assets ?? [{ id: config.assetClass, weight: 1 }];
  const nAssets = rawAssetConfigs.length;
  // For single-asset, always use config.assetClass regardless of what assets[0].id says.
  const assetConfigs = nAssets === 1
    ? [{ id: config.assetClass, weight: rawAssetConfigs[0].weight }]
    : rawAssetConfigs;

  // Resolve per-asset FV path arrays
  const resolvedFvPaths: number[][] = fvPaths ?? [fvPath];

  const records: PeriodRecord[] = [];

  for (const agent of agents) agent.resetBelief();

  // Per-asset price tracking state
  const lastPrices = new Array(nAssets).fill(fv1);
  const prevPrices = new Array(nAssets).fill(fv1);
  const lastDividends = new Array(nAssets).fill(config.expectedDiv);
  const vwaps = new Array(nAssets).fill(fv1);

  for (let period = 1; period <= nPeriods; period++) {
    // Compute FV per asset for this period
    const fvs = assetConfigs.map((ac, j) =>
      computeFV(period, nPeriods, { ...config, assetClass: ac.id }, resolvedFvPaths[j] ?? [])
    );

    if (nAssets === 1) {
      // --- Single-asset path (identical to pre-refactor behavior) ---
      const fv = fvs[0];
      const book = new OrderBook();
      const allTrades: Trade[] = [];
      let halted = false;

      for (let tick = 0; tick < ticksPerPeriod; tick++) {
        if (halted) break;

        const order = rng.permutation(nAgents);
        for (const idx of order) {
          agents[idx].maybeSubmit(fv, lastPrices[0], period, book, rng, config,
            prevPrices[0], lastDividends[0], vwaps[0]);
        }
        const trades = book.match(agents, tick, 0);
        allTrades.push(...trades);

        if (config.regulator?.enabled && trades.length > 0) {
          const lastTradePrice = trades[trades.length - 1].price;
          if (fv > 0 && Math.abs(lastTradePrice - fv) / fv > config.regulator.threshold) {
            halted = true;
          }
        }
      }

      const prices = allTrades.map(t => t.price);
      const meanPrice = prices.length > 0
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : lastPrices[0] * 0.95;
      prevPrices[0] = lastPrices[0];
      lastPrices[0] = meanPrice;

      const dividend = generateDividend(rng, config, period, resolvedFvPaths[0], nPeriods);
      for (const agent of agents) agent.cash += agent.shares * dividend;
      vwaps[0] = meanPrice;
      lastDividends[0] = dividend;

      records.push({
        round: roundNum,
        period,
        fv,
        meanPrice,
        trades: allTrades,
        agentStates: agents.map(a => ({
          id: a.id, belief: a.belief, cash: a.cash, shares: a.shares, type: a.type,
          rho: a.rho, riskPref: a.riskPref,
        })),
      });

    } else {
      // --- Multi-asset path ---
      const books = Array.from({ length: nAssets }, () => new OrderBook());
      const allTradesByAsset: Trade[][] = Array.from({ length: nAssets }, () => []);
      let halted = false;

      for (let tick = 0; tick < ticksPerPeriod; tick++) {
        if (halted) break;

        const order = rng.permutation(nAgents);
        for (const idx of order) {
          agents[idx].maybeSubmitMulti(
            fvs, lastPrices, period, books, rng, config,
            prevPrices, lastDividends, vwaps,
          );
        }

        // Match all books; circuit breaker checks asset 0
        for (let j = 0; j < nAssets; j++) {
          const trades = books[j].match(agents, tick, j);
          allTradesByAsset[j].push(...trades);

          if (j === 0 && config.regulator?.enabled && trades.length > 0) {
            const lastTradePrice = trades[trades.length - 1].price;
            if (fvs[0] > 0 && Math.abs(lastTradePrice - fvs[0]) / fvs[0] > config.regulator.threshold) {
              halted = true;
            }
          }
        }
      }

      // Compute per-asset mean prices and pay dividends
      const assetData: AssetPeriodData[] = [];
      for (let j = 0; j < nAssets; j++) {
        const tradePrices = allTradesByAsset[j].map(t => t.price);
        const meanPriceJ = tradePrices.length > 0
          ? tradePrices.reduce((a, b) => a + b, 0) / tradePrices.length
          : lastPrices[j] * 0.95;
        prevPrices[j] = lastPrices[j];
        lastPrices[j] = meanPriceJ;

        const dividend = generateDividend(rng, config, period, resolvedFvPaths[j] ?? [], nPeriods);
        for (const agent of agents) agent.cash += agent.sharesPerAsset[j] * dividend;
        vwaps[j] = meanPriceJ;
        lastDividends[j] = dividend;

        assetData.push({
          assetId: assetConfigs[j].id,
          fv: fvs[j],
          meanPrice: meanPriceJ,
          trades: allTradesByAsset[j],
        });
      }

      // All trades flattened for the backward-compat top-level trades field
      const allTrades = allTradesByAsset.flat();

      records.push({
        round: roundNum,
        period,
        fv: assetData[0].fv,
        meanPrice: assetData[0].meanPrice,
        trades: assetData[0].trades,
        agentStates: agents.map(a => ({
          id: a.id, belief: a.belief, cash: a.cash, shares: a.shares, type: a.type,
          rho: a.rho, riskPref: a.riskPref,
        })),
        assets: assetData,
      });

      void allTrades; // suppress unused-var lint; allTrades used via assetData[0].trades
    }
  }

  return records;
}

/**
 * Run a complete multi-round session.
 *
 * The new primary signature accepts a SimConfig.  The legacy positional
 * signature (sessionId, treatment, seed) is preserved as a convenience
 * overload so existing callers don't break.
 */
export function runSession(config: SimConfig, sessionId?: number): SessionResult;
export function runSession(sessionId: number, treatment: string, seed: number): SessionResult;
export function runSession(
  configOrId: SimConfig | number,
  treatmentOrSessionId?: string | number,
  seed?: number,
): SessionResult {
  // Resolve overload
  let config: SimConfig;
  let sessionId: number;

  if (typeof configOrId === 'number') {
    // Legacy call: runSession(sessionId, treatment, seed)
    config = {
      ...DLM_DEFAULTS,
      treatment: (treatmentOrSessionId as string) as 'R4-2/3' | 'R4-1/3',
      seed: seed ?? 42,
    };
    sessionId = configOrId;
  } else {
    config = configOrId;
    sessionId = (treatmentOrSessionId as number) ?? config.seed;
  }

  const { nAgents, nRounds, fv1 } = config;
  const rng = new PRNG(config.seed);

  const rawAssetConfigs = config.assets ?? [{ id: config.assetClass, weight: 1 }];
  const nAssets = rawAssetConfigs.length;
  // For single-asset, config.assetClass is canonical; assets[] only authoritative for nAssets > 1.
  const assetConfigs = nAssets === 1
    ? [{ id: config.assetClass, weight: rawAssetConfigs[0].weight }]
    : rawAssetConfigs;

  // Generate one FV path per asset (seed offset by prime * asset index for independence)
  const fvPaths = assetConfigs.map((ac, j) =>
    generateFVPath(config.seed + j * 7919, { ...config, assetClass: ac.id })
  );

  // Generate endowments per agent from config ranges (not hardcoded table)
  const agentEndowments = Array.from({ length: nAgents }, () => generateEndowment(rng, config));

  const agents = Array.from({ length: nAgents }, (_, i) => {
    const riskPref = assignRiskPreference(i, nAgents, config.riskSplit);
    return makeAgent(i, agentEndowments[i], rng, fv1, riskPref);
  });

  for (let i = 0; i < Math.min(config.nFundamentalists, agents.length); i++) {
    agents[i].type = 'fundamentalist';
  }
  for (let i = config.nFundamentalists;
       i < Math.min(config.nFundamentalists + config.nTrendFollowers, agents.length); i++) {
    agents[i].type = 'trend-follower';
  }

  const allPeriods: PeriodRecord[] = [];

  for (let roundNum = 1; roundNum <= nRounds; roundNum++) {
    // Restore endowments each round (DLM convention)
    for (let i = 0; i < agents.length; i++) {
      agents[i].cash = agentEndowments[i].cash;
      agents[i].sharesPerAsset = [...agentEndowments[i].sharesPerAsset];
    }

    if (roundNum === nRounds) {
      const replaceFraction = config.treatment === 'R4-2/3' ? 1 / 3 : 2 / 3;
      const nReplace = Math.max(1, Math.round(nAgents * replaceFraction));
      const replaceIds = rng.choiceN(nAgents, nReplace);
      for (const idx of replaceIds) {
        const riskPref = assignRiskPreference(idx, nAgents, config.riskSplit);
        const freshEndow = generateEndowment(rng, config);
        agents[idx] = makeAgent(idx, freshEndow, rng, fv1, riskPref);
      }

      for (let i = 0; i < Math.min(config.nFundamentalists, agents.length); i++) {
        agents[i].type = 'fundamentalist';
      }
      for (let i = config.nFundamentalists;
           i < Math.min(config.nFundamentalists + config.nTrendFollowers, agents.length); i++) {
        agents[i].type = 'trend-follower';
      }
    }

    // Pass fvPaths for multi-asset; for single-asset, fvPaths[0] == the old fvPath
    const records = runRound(agents, roundNum, rng, config, fvPaths[0], nAssets > 1 ? fvPaths : undefined);
    allPeriods.push(...records);

    for (const agent of agents) agent.learn();
  }

  return { sessionId, treatment: config.treatment, periods: allPeriods };
}

export function runExperiment(seed = 42, nSessions = 10): SessionResult[] {
  const results: SessionResult[] = [];
  for (let i = 0; i < nSessions; i++) {
    const treatment = i < Math.ceil(nSessions / 2) ? 'R4-2/3' : 'R4-1/3';
    results.push(runSession({ ...DLM_DEFAULTS, seed: seed + i * 1000, treatment }, i + 1));
  }
  return results;
}
