/**
 * TypeScript port of the DLM (2005) bubble simulation engine.
 * Client-side CDA with heterogeneous agents producing bubble-crash dynamics.
 */

import { fundamentalValue as computeFV, generateDividend, generateFVPath } from './assets';
import { DLM_DEFAULTS, type SimConfig } from './types';

// --- Legacy constant exports (kept for back-compat; values come from DLM_DEFAULTS) ---

export const N_AGENTS = DLM_DEFAULTS.nAgents;
export const N_ROUNDS = DLM_DEFAULTS.nRounds;
export const N_PERIODS = DLM_DEFAULTS.nPeriods;
export const TICKS_PER_PERIOD = DLM_DEFAULTS.ticksPerPeriod;
export const DIVIDENDS = DLM_DEFAULTS.dividends;
export const FV_1 = DLM_DEFAULTS.fv1;

// DLM-calibrated fixed endowments (6 agents: 3 cash-rich/share-light, 3 cash-light/share-rich)
export const ENDOWMENTS = [
  { cash: 200, shares: 6 },
  { cash: 200, shares: 6 },
  { cash: 200, shares: 6 },
  { cash: 600, shares: 2 },
  { cash: 600, shares: 2 },
  { cash: 600, shares: 2 },
];

// Re-export DLM_DEFAULTS so call sites can build configs without importing types directly
export { DLM_DEFAULTS } from './types';

export const AGENT_TYPES_INEXP: [number, number, number, number][] = [
  [0.08, 0.05, 12.0, 0.15], // speculator
  [0.08, 0.05, 12.0, 0.15],
  [0.17, 0.11, 11.0, 0.04], // moderate
  [0.17, 0.11, 11.0, 0.04],
  [0.35, 0.28, 10.0, 0.0],  // aware
  [0.35, 0.28, 10.0, 0.0],
];

const EXP_ALPHA: [number, number] = [0.55, 0.82];
const EXP_ADAPT: [number, number] = [0.35, 0.60];
const EXP_NOISE = 5.0;

const LEARN_ALPHA = 0.10;
const LEARN_ADAPT = 0.07;
const LEARN_NOISE_DECAY = 0.80;
const SUBMIT_PROB = 0.33;

const WITHIN_ROUND_RATE = 0.022;
const WITHIN_ROUND_EXP_BOOST = 0.8;

const FEAR_MULTIPLIER = 3.0;
const FEAR_THRESHOLD = 0.10;

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

export type AgentType = 'speculator' | 'moderate' | 'aware';

export class Agent {
  id: number;
  cash: number;
  shares: number;
  alpha: number;
  adaptRate: number;
  noiseStd: number;
  beliefBias: number;
  belief: number;
  roundsCompleted: number;
  type: AgentType;

  private fv1: number;

  constructor(
    id: number, cash: number, shares: number,
    alpha: number, adaptRate: number, noiseStd: number,
    beliefBias: number, type: AgentType,
    fv1: number = FV_1,
  ) {
    this.id = id;
    this.cash = cash;
    this.shares = shares;
    this.alpha = alpha;
    this.adaptRate = adaptRate;
    this.noiseStd = noiseStd;
    this.beliefBias = beliefBias;
    this.fv1 = fv1;
    this.belief = fv1 * (1 + beliefBias);
    this.roundsCompleted = 0;
    this.type = type;
  }

  get isExperienced(): boolean {
    return this.roundsCompleted > 0;
  }

  updateBelief(lastPrice: number, fv: number) {
    const fvWeight = this.alpha * 0.35;
    const target = (1 - fvWeight) * lastPrice + fvWeight * fv;
    const gap = this.belief > 0 ? (this.belief - target) / this.belief : 0;
    const rate = gap > FEAR_THRESHOLD
      ? Math.min(0.95, this.adaptRate * FEAR_MULTIPLIER)
      : this.adaptRate;
    this.belief = (1 - rate) * this.belief + rate * target;
  }

  valuation(fv: number, period: number, rng: PRNG): number {
    const boost = (period - 1) * WITHIN_ROUND_RATE * (1 + this.roundsCompleted * WITHIN_ROUND_EXP_BOOST);
    const effectiveAlpha = Math.min(0.92, this.alpha + boost);
    let base = effectiveAlpha * fv + (1 - effectiveAlpha) * this.belief;
    if (this.roundsCompleted < 2 && base > fv * 1.15) {
      base += (base - fv) * 0.40;
    }
    return Math.max(1.0, base + rng.normal(0, this.noiseStd));
  }

  maybeSubmit(fv: number, lastPrice: number, period: number, book: OrderBook, rng: PRNG) {
    const prob = SUBMIT_PROB + this.roundsCompleted * 0.06;
    if (rng.next() > prob) return;

    if (this.shares > 0 && fv < this.belief * 0.65) {
      const panicProb = 0.30 + this.alpha * 0.5;
      if (rng.next() < panicProb) {
        const price = fv * rng.uniform(0.1, 0.55);
        if (price > 0.5) book.submitAsk(price, this.id);
        return;
      }
    }

    const v = this.valuation(fv, period, rng);
    const canBuy = this.cash >= Math.max(5.0, fv * 0.3);
    const canSell = this.shares > 0;
    if (!canBuy && !canSell) return;

    let side: 'bid' | 'ask';
    if (canBuy && canSell) {
      if (v > lastPrice * 1.01) side = 'bid';
      else if (v < lastPrice * 0.99) side = 'ask';
      else side = rng.next() > 0.5 ? 'bid' : 'ask';
    } else if (canBuy) {
      side = 'bid';
    } else {
      side = 'ask';
    }

    const spread = Math.abs(rng.normal(0, this.noiseStd * 0.25));
    if (side === 'bid') {
      const price = v - spread;
      if (price > 0 && price <= this.cash) book.submitBid(price, this.id);
    } else {
      const price = v + spread;
      if (price > 0) book.submitAsk(price, this.id);
    }
  }

  learn() {
    this.roundsCompleted++;
    this.alpha = Math.min(0.90, this.alpha + LEARN_ALPHA);
    this.adaptRate = Math.min(0.60, this.adaptRate + LEARN_ADAPT);
    this.noiseStd = Math.max(3.5, this.noiseStd * LEARN_NOISE_DECAY);
  }

  resetBelief() {
    const bias = this.roundsCompleted === 0 ? this.beliefBias : 0;
    this.belief = this.fv1 * (1 + bias);
  }
}

// --- Factory ---

function getAgentType(idx: number): AgentType {
  if (idx < 2) return 'speculator';
  if (idx < 4) return 'moderate';
  return 'aware';
}

function makeAgentInexperienced(
  id: number,
  endow: { cash: number; shares: number },
  typeIdx: number,
  rng: PRNG,
  fv1: number,
): Agent {
  const [baseAlpha, baseAdapt, baseNoise, bias] = AGENT_TYPES_INEXP[typeIdx];
  const jitter = rng.uniform(0.8, 1.2);
  return new Agent(
    id, endow.cash, endow.shares,
    baseAlpha * jitter, baseAdapt * jitter,
    baseNoise * rng.uniform(0.85, 1.15),
    bias * rng.uniform(0.7, 1.3),
    getAgentType(typeIdx),
    fv1,
  );
}

// --- Simulation state (for incremental stepping) ---

export interface PeriodRecord {
  round: number;
  period: number;
  fv: number;
  meanPrice: number;
  trades: Trade[];
  agentStates: { id: number; belief: number; cash: number; shares: number; type: AgentType }[];
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

  for (let period = 1; period <= nPeriods; period++) {
    const fv = computeFV(period, nPeriods, config, fvPath);
    for (const agent of agents) agent.updateBelief(lastPrice, fv);

    const book = new OrderBook();
    const allTrades: Trade[] = [];

    for (let tick = 0; tick < ticksPerPeriod; tick++) {
      const order = rng.permutation(nAgents);
      for (const idx of order) {
        agents[idx].maybeSubmit(fv, lastPrice, period, book, rng);
      }
      const trades = book.match(agents, tick);
      allTrades.push(...trades);
    }

    const prices = allTrades.map(t => t.price);
    const meanPrice = prices.length > 0
      ? prices.reduce((a, b) => a + b, 0) / prices.length
      : lastPrice * 0.95;
    lastPrice = meanPrice;

    const dividend = generateDividend(rng, config);
    for (const agent of agents) agent.cash += agent.shares * dividend;

    records.push({
      round: roundNum,
      period,
      fv,
      meanPrice,
      trades: allTrades,
      agentStates: agents.map(a => ({
        id: a.id, belief: a.belief, cash: a.cash, shares: a.shares, type: a.type,
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

  const typeOrder = rng.permutation(nAgents);
  const agents = Array.from({ length: nAgents }, (_, i) =>
    makeAgentInexperienced(i, ENDOWMENTS[i % ENDOWMENTS.length], typeOrder[i % AGENT_TYPES_INEXP.length], rng, fv1)
  );
  const allPeriods: PeriodRecord[] = [];

  for (let roundNum = 1; roundNum <= nRounds; roundNum++) {
    // Restore endowments from fixed ENDOWMENTS table (DLM convention)
    for (let i = 0; i < agents.length; i++) {
      agents[i].cash = ENDOWMENTS[i % ENDOWMENTS.length].cash;
      agents[i].shares = ENDOWMENTS[i % ENDOWMENTS.length].shares;
    }

    if (roundNum === 4) {
      const nReplace = config.treatment === 'R4-2/3' ? 2 : 4;
      const replaceIds = rng.choiceN(nAgents, nReplace);
      const r4Types = rng.permutation(nReplace);
      for (let j = 0; j < replaceIds.length; j++) {
        const idx = replaceIds[j];
        const baseIdx = r4Types[j] % AGENT_TYPES_INEXP.length;
        const [bAlpha, bAdapt, bNoise] = AGENT_TYPES_INEXP[baseIdx];
        agents[idx] = new Agent(
          idx, ENDOWMENTS[idx % ENDOWMENTS.length].cash, ENDOWMENTS[idx % ENDOWMENTS.length].shares,
          bAlpha * 1.5 * rng.uniform(0.8, 1.2),
          bAdapt * 1.3 * rng.uniform(0.8, 1.2),
          bNoise * rng.uniform(0.85, 1.15),
          0.0,
          getAgentType(baseIdx),
          fv1,
        );
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
