/**
 * TypeScript port of the DLM (2005) bubble simulation engine.
 * Client-side CDA with heterogeneous agents producing bubble-crash dynamics.
 */

import { fundamentalValue as computeFV, generateDividend, generateFVPath } from './assets';
import { DLM_DEFAULTS, type SimConfig, type ExperienceCurveConfig, type HeuristicWeights, type RiskPreference } from './types';

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

  valuation(
    fv: number, period: number, rng: PRNG,
    exp: ExperienceCurveConfig, heuristics: HeuristicWeights,
    lastPrice: number, prevPrice: number, lastDividend: number,
    discountRate: number, priorBias: boolean, priorNoise: boolean, vwap: number,
  ): number {
    const alpha_i = this.type === 'fundamentalist' ? 1.0
      : this.type === 'trend-follower' ? 0.0
      : this.experienceAlpha(exp);
    const sigma_i = this.experienceNoise(exp);
    const omega_i = this.experienceOmega(exp);
    const H = this.heuristic(heuristics, lastPrice, prevPrice, lastDividend, fv, discountRate);
    const blend = alpha_i * fv + (1 - alpha_i) * H;
    const bias = priorBias ? this.beliefBias : 0;
    const noise = priorNoise ? rng.normal(0, sigma_i) : 0;
    const V_prior = Math.max(0, blend * (1 + bias) + noise);
    const peerSignal = vwap > 0 ? vwap : fv;
    return Math.max(1.0, omega_i * V_prior + (1 - omega_i) * peerSignal);
  }

  maybeSubmit(
    fv: number, lastPrice: number, period: number, book: OrderBook, rng: PRNG,
    config: SimConfig, prevPrice: number, lastDividend: number, vwap: number,
  ) {
    const v = this.valuation(fv, period, rng, config.experience, config.heuristics,
      lastPrice, prevPrice, lastDividend, config.discountRate,
      config.priorBias, config.priorNoise, vwap);

    const bestBid = book.bestBidPrice;
    const bestAsk = book.bestAskPrice;
    const w0 = this.cash + this.shares * v;
    const U0 = this.crraUtility(w0);

    type Action = { name: string; eu: number; submit: () => void };
    const actions: Action[] = [];

    // HOLD — baseline
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

    // Argmax with tie-breaking noise
    let best = actions[0];
    for (let i = 1; i < actions.length; i++) {
      if (actions[i].eu > best.eu + rng.normal(0, 0.001)) best = actions[i];
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
  const shares = config.endowmentShares[Math.floor(rng.next() * config.endowmentShares.length)];
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
  const bias = biasDir * 0.15;
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
  fv: number;
  meanPrice: number;
  trades: Trade[];
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
 *
 * @param agents     Mutable agent array (updated in-place)
 * @param roundNum   1-indexed round number (recorded in output)
 * @param rng        Seeded PRNG
 * @param config     SimConfig — reads nPeriods, ticksPerPeriod, nAgents, fv1, assetClass
 * @param fvPath     Pre-generated FV path (pass for random-walk / jump-crash)
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
  let lastPrice = fv1;
  const records: PeriodRecord[] = [];

  for (const agent of agents) agent.resetBelief();

  let prevPrice = fv1;
  let lastDividend = config.expectedDiv;
  let vwap = fv1;

  for (let period = 1; period <= nPeriods; period++) {
    const fv = computeFV(period, nPeriods, config, fvPath);

    const book = new OrderBook();
    const allTrades: Trade[] = [];

    for (let tick = 0; tick < ticksPerPeriod; tick++) {
      const order = rng.permutation(nAgents);
      for (const idx of order) {
        agents[idx].maybeSubmit(fv, lastPrice, period, book, rng, config, prevPrice, lastDividend, vwap);
      }
      const trades = book.match(agents, tick);
      allTrades.push(...trades);
    }

    const prices = allTrades.map(t => t.price);
    const meanPrice = prices.length > 0
      ? prices.reduce((a, b) => a + b, 0) / prices.length
      : lastPrice * 0.95;
    prevPrice = lastPrice;
    lastPrice = meanPrice;

    const dividend = generateDividend(rng, config, period, fvPath, nPeriods);
    for (const agent of agents) agent.cash += agent.shares * dividend;
    vwap = meanPrice;
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

  // Pre-generate FV path for stochastic asset classes
  const fvPath = generateFVPath(config.seed, config);

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

    const records = runRound(agents, roundNum, rng, config, fvPath);
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
