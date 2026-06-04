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

// Behavioral prior bias is strongest for novices and fades as traders gain experience
// (DLM's central mechanism: experience erodes the bias that drives bubbles). The bias
// applied in round r is beliefBias * BIAS_EXPERIENCE_DECAY^roundsCompleted, so it decays
// smoothly across rounds 1->3 and re-enters when novices arrive at the replacement round.
const BIAS_EXPERIENCE_DECAY = 0.6;

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

/** Pearson correlation of two equal-length series; returns 1 on degenerate input. */
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 1;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return (da > 0 && db > 0) ? num / Math.sqrt(da * db) : 1;
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

  match(agents: Agent[], tick: number): Trade[] {
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
      if (buyer.cash < tradePrice || seller.shares < 1) continue;
      buyer.cash -= tradePrice;
      buyer.shares += 1;
      seller.cash += tradePrice;
      seller.shares -= 1;
      trades.push({ buyer: bestBid.agentId, seller: bestAsk.agentId, price: tradePrice, tick });
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
  shares: number;
  beliefBias: number;
  belief: number;
  roundsCompleted: number;
  type: AgentType;
  rho: number;
  riskPref: RiskPreference;

  private fv1: number;

  constructor(
    id: number, cash: number, shares: number,
    beliefBias: number, type: AgentType,
    fv1: number = FV_1,
    riskPref: RiskPreference = 'risk-neutral',
    rho: number = 0,
  ) {
    this.id = id;
    this.cash = cash;
    this.shares = shares;
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

  /**
   * Pre-blend (private) prior valuation V_prior and the agent's self-weight omega.
   * V_prior = max(0, [alpha*FV~ + (1-alpha)*H](1+bias)(1+u)), matching m0nius v3 §2.
   * The peer blend (V_post = omega*V_prior + (1-omega)*mBar) is applied once per period in
   * runRound using the CROSS-SECTIONAL mean of current priors (mBar), not a lagged price —
   * this is the m0nius m̄_t peer-message mean and is what keeps prices tracking current FV.
   */
  priorValuation(
    fv: number, period: number, rng: PRNG,
    exp: ExperienceCurveConfig, heuristics: HeuristicWeights,
    lastPrice: number, prevPrice: number, lastDividend: number,
    discountRate: number, priorBias: boolean, priorNoise: boolean,
    valuationNoise: number = 0.03,
    br?: BoundedRationalityConfig,
  ): { vPrior: number; omega: number } {
    const effectiveRC = br?.enabled ? Math.min(this.roundsCompleted, br.T) : this.roundsCompleted;

    const perceivedFV = br?.enabled ? Math.max(0, fv + rng.normal(0, br.sigma)) : fv;

    const alpha_i = this.type === 'fundamentalist' ? 1.0
      : this.type === 'trend-follower' ? 0.0
      : Math.min(1, exp.alpha0 + exp.gammaAlpha * effectiveRC);
    const omega_i = Math.min(1.0, exp.omega0 + exp.deltaOmega * Math.min(exp.kMax, effectiveRC));
    const H = this.heuristic(heuristics, lastPrice, prevPrice, lastDividend, perceivedFV, discountRate);
    const blend = alpha_i * perceivedFV + (1 - alpha_i) * H;
    const bias = priorBias ? this.beliefBias * Math.pow(BIAS_EXPERIENCE_DECAY, this.roundsCompleted) : 0;
    // m0nius prior noise: small multiplicative jitter U[-vn, +vn] (default ±3%), scaled by
    // the experience factor sigma_i/sigma0 (=1 for novices, decays toward 0 with rounds) so
    // beliefs sharpen as agents gain experience.
    const u = priorNoise ? rng.uniform(-valuationNoise, valuationNoise) : 0;
    const V_prior = Math.max(0, blend * (1 + bias) * (1 + u));

    return { vPrior: V_prior, omega: omega_i };
  }

  /**
   * Blend a prior valuation with the cross-sectional peer mean mBar.
   * V_post = max(1, omega*V_prior + (1-omega)*mBar).
   */
  blendBelief(vPrior: number, omega: number, mBar: number): number {
    return Math.max(1.0, omega * vPrior + (1 - omega) * mBar);
  }

  maybeSubmit(
    fv: number, book: OrderBook, rng: PRNG, config: SimConfig,
  ) {
    const br = config.boundedRationality;
    // Belief (V_post) is formed once per period in runRound; reuse it for every tick.
    const v = this.belief;

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

function generateEndowment(rng: PRNG, config: SimConfig): { cash: number; shares: number } {
  const [minCash, maxCash] = config.endowmentCash;
  const cash = Math.round(rng.uniform(minCash, maxCash));
  const pool = config.endowmentShares;
  const shares = pool[Math.floor(rng.next() * pool.length)];
  return { cash, shares };
}

function makeAgent(
  id: number,
  endow: { cash: number; shares: number },
  rng: PRNG,
  fv1: number,
  riskPref: RiskPreference,
): Agent {
  const biasDir = rng.next() < 0.33 ? 1 : rng.next() < 0.5 ? -1 : 0;
  // Novice behavioral-bias magnitude, calibrated so round-1 mean-abs-deviation matches the
  // m0nius batch (~3.6¢); experience decays it via BIAS_EXPERIENCE_DECAY.
  const bias = biasDir * 0.12;
  return new Agent(
    id, endow.cash, endow.shares,
    bias, 'utility',
    fv1, riskPref, sampleRho(riskPref, rng),
  );
}

// --- Simulation state (for incremental stepping) ---

export interface PeriodRecord {
  round: number;
  period: number;
  fv: number;           // backward-compat: always assets[0].fv
  meanPrice: number;    // backward-compat: always assets[0].meanPrice
  trades: Trade[];      // backward-compat: always assets[0].trades
  agentStates: { id: number; belief: number; cash: number; shares: number; type: AgentType; rho: number; riskPref: RiskPreference }[];
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
 * Single asset per round (config.assetClass) — there is no multi-asset portfolio.
 *
 * @param agents   Mutable agent array (updated in-place)
 * @param roundNum 1-indexed round number (recorded in output)
 * @param rng      Seeded PRNG
 * @param config   SimConfig — reads nPeriods, ticksPerPeriod, nAgents, fv1, assetClass
 * @param fvPath   Pre-generated FV path (used by stochastic asset classes)
 */
export function runRound(
  agents: Agent[],
  roundNum: number,
  rng: PRNG,
  config: SimConfig = DLM_DEFAULTS,
  fvPath: number[] = [],
): PeriodRecord[] {
  const { nPeriods, ticksPerPeriod, fv1 } = config;
  const nAgents = agents.length;

  const records: PeriodRecord[] = [];

  for (const agent of agents) agent.resetBelief();

  let lastPrice = fv1;
  let prevPrice = fv1;
  let lastDividend = config.expectedDiv;

  for (let period = 1; period <= nPeriods; period++) {
    const fv = computeFV(period, nPeriods, config, fvPath);
    const book = new OrderBook();
    const allTrades: Trade[] = [];
    let halted = false;

    // Form each agent's belief (V_post) once for the whole period: compute all priors,
    // take their cross-sectional mean (m0nius m̄_t peer signal), then blend.
    const priors = agents.map(a => a.priorValuation(
      fv, period, rng, config.experience, config.heuristics,
      lastPrice, prevPrice, lastDividend, config.discountRate,
      config.priorBias, config.priorNoise, config.valuationNoise, config.boundedRationality));
    // Peer signal m̄_t weights confident (experienced, high-ω) agents more: experienced
    // traders anchor the market near FV, so even a minority of them suppresses bubbles
    // disproportionately (DLM point 2). In an all-novice round (equal ω) this is the plain
    // mean, so the round-1 bubble is unaffected.
    const wSum = priors.reduce((s, p) => s + p.omega, 0) || 1;
    const mBar = priors.reduce((s, p) => s + p.omega * p.vPrior, 0) / wSum;
    // Social learning (DLM point 2): novices defer to the experienced consensus when
    // veterans are present, so they put LESS weight on their own (biased) prior as the
    // veteran fraction rises. With no veterans (round 1) this is a no-op, so the round-1
    // bubble is unaffected; in a mixed replacement round even a minority of veterans
    // pulls novices toward fundamentals, abating the bubble for both treatments.
    const vetFrac = nAgents > 0
      ? agents.filter(a => a.roundsCompleted > 0).length / nAgents
      : 0;
    agents.forEach((a, i) => {
      const omega = a.roundsCompleted === 0
        ? priors[i].omega * (1 - vetFrac)
        : priors[i].omega;
      a.belief = a.blendBelief(priors[i].vPrior, omega, mBar);
    });

    for (let tick = 0; tick < ticksPerPeriod; tick++) {
      if (halted) break;

      const order = rng.permutation(nAgents);
      for (const idx of order) {
        agents[idx].maybeSubmit(fv, book, rng, config);
      }
      const trades = book.match(agents, tick);
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
      : lastPrice * 0.95;
    prevPrice = lastPrice;
    lastPrice = meanPrice;

    const dividend = generateDividend(rng, config, period, fvPath, nPeriods);
    for (const agent of agents) agent.cash += agent.shares * dividend;
    lastDividend = dividend;

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

  // Single asset per session. An optional postAssetClass swaps in at the replacement
  // round (r = nRounds); the pre/post FV-path correlation drives the experience blend.
  const preAsset = config.assetClass;
  const swap = !!config.postAssetClass && config.postAssetClass !== preAsset;
  const postAsset = swap ? config.postAssetClass! : preAsset;

  const preFvPath = generateFVPath(config.seed, { ...config, assetClass: preAsset });
  const postFvPath = swap
    ? generateFVPath(config.seed + 7919, { ...config, assetClass: postAsset })
    : preFvPath;

  // |corr| of the two assets' FV paths over the session (1 when no swap / identical).
  const preSeries = Array.from({ length: config.nPeriods }, (_, t) =>
    computeFV(t + 1, config.nPeriods, { ...config, assetClass: preAsset }, preFvPath));
  const postSeries = Array.from({ length: config.nPeriods }, (_, t) =>
    computeFV(t + 1, config.nPeriods, { ...config, assetClass: postAsset }, postFvPath));
  const assetCorr = swap ? Math.abs(pearson(preSeries, postSeries)) : 1;

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
      agents[i].shares = agentEndowments[i].shares;
    }

    const isSwapRound = roundNum === nRounds;

    if (isSwapRound) {
      // R4-2/3 keeps 2/3 experienced (replace 1/3); R4-1/3 keeps 1/3 (replace 2/3).
      const replaceFraction = config.treatment === 'R4-2/3' ? 1 / 3 : 2 / 3;
      const nReplace = Math.max(1, Math.round(nAgents * replaceFraction));
      const replaceIds = rng.choiceN(nAgents, nReplace);
      const replaced = new Set(replaceIds);
      for (const idx of replaceIds) {
        const riskPref = assignRiskPreference(idx, nAgents, config.riskSplit);
        const freshEndow = generateEndowment(rng, config);
        agents[idx] = makeAgent(idx, freshEndow, rng, fv1, riskPref);
      }

      // P4 — experience does not transfer across (uncorrelated) assets: when the asset
      // swaps at the replacement round, discount surviving veterans' experience toward
      // novice by (1 - |corr|). corr = 1 (same asset) keeps experience fully intact.
      if (swap) {
        for (let i = 0; i < agents.length; i++) {
          if (replaced.has(i)) continue;
          agents[i].roundsCompleted = Math.round(agents[i].roundsCompleted * assetCorr);
        }
      }

      for (let i = 0; i < Math.min(config.nFundamentalists, agents.length); i++) {
        agents[i].type = 'fundamentalist';
      }
      for (let i = config.nFundamentalists;
           i < Math.min(config.nFundamentalists + config.nTrendFollowers, agents.length); i++) {
        agents[i].type = 'trend-follower';
      }
    }

    // The replacement round trades the post-swap asset; earlier rounds trade the pre asset.
    const roundAsset = isSwapRound ? postAsset : preAsset;
    const roundFvPath = isSwapRound ? postFvPath : preFvPath;
    const roundConfig = roundAsset === config.assetClass ? config : { ...config, assetClass: roundAsset };
    const records = runRound(agents, roundNum, rng, roundConfig, roundFvPath);
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
