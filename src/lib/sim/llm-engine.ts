import { OrderBook, PRNG } from './engine';
import { fundamentalValue as computeFV, generateDividend, generateFVPath } from './assets';
import { callLLM } from './llm-client';
import { buildPrompt } from './llm-prompts';
import type {
  LLMAgentState, LLMConfig, LLMDecision, LLMPeriodRecord,
  LLMSessionResult, PlanType, RiskPreference, SimConfig, TickProgress,
  ExperienceCurveConfig,
} from './types';

// Private LLM-specific constants not yet promoted to SimConfig
const LLM_PRIVATE = {
  trustLambda: 0.30,
  biasMagnitude: 0.15,
};

function sampleRho(pref: RiskPreference, rng: PRNG): number {
  switch (pref) {
    case 'risk-loving': return rng.uniform(-0.9, -0.1);
    case 'risk-neutral': return 0;
    case 'risk-averse': return rng.uniform(0.1, 0.9);
  }
}

function assignRiskPreferences(n: number, rng: PRNG, riskSplit: [number, number, number]): RiskPreference[] {
  const prefs: RiskPreference[] = [];
  const nLoving = Math.round(n * riskSplit[0]);
  const nNeutral = Math.round(n * riskSplit[1]);
  for (let i = 0; i < nLoving; i++) prefs.push('risk-loving');
  for (let i = 0; i < nNeutral; i++) prefs.push('risk-neutral');
  while (prefs.length < n) prefs.push('risk-averse');
  const order = rng.permutation(n);
  return order.map(i => prefs[i]);
}

function createAgents(config: SimConfig, rng: PRNG): LLMAgentState[] {
  const { nAgents, riskSplit, endowmentCash, endowmentShares, fv1 } = config;
  const prefs = assignRiskPreferences(nAgents, rng, riskSplit);
  return Array.from({ length: nAgents }, (_, i) => {
    const riskPref = prefs[i];
    const rho = sampleRho(riskPref, rng);
    const biasDir = rng.next() < 0.33 ? 1 : rng.next() < 0.5 ? -1 : 0;
    return {
      id: i,
      riskPref,
      rho,
      cash: Math.round(rng.uniform(endowmentCash[0], endowmentCash[1])),
      shares: rng.choice(endowmentShares),
      bias: biasDir * LLM_PRIVATE.biasMagnitude,
      omega: config.experience.omega0,
      belief: fv1 * (1 + biasDir * LLM_PRIVATE.biasMagnitude),
      roundsCompleted: 0,
      lastAction: null,
    };
  });
}

function computeOmega(roundsCompleted: number, exp: ExperienceCurveConfig): number {
  const k = Math.min(roundsCompleted, exp.kMax);
  return exp.omega0 + k * exp.deltaOmega;
}

function updateBeliefs(agents: LLMAgentState[], vwap: number, fv: number, exp: ExperienceCurveConfig) {
  for (const agent of agents) {
    agent.omega = computeOmega(agent.roundsCompleted, exp);
    const prior = agent.belief * (1 + agent.bias);
    const peerSignal = vwap > 0 ? vwap : fv;
    agent.belief = agent.omega * prior + (1 - agent.omega) * peerSignal;
    agent.belief = Math.max(1, agent.belief);
  }
}

function updateTrust(
  trustMatrix: number[][],
  agents: LLMAgentState[],
  vwap: number,
): void {
  const n = agents.length;
  for (let r = 0; r < n; r++) {
    for (let s = 0; s < n; s++) {
      if (r === s) continue;
      const closeness = vwap > 0
        ? Math.max(0, 1 - Math.abs(agents[s].belief - vwap) / vwap)
        : 0.5;
      trustMatrix[r][s] = (1 - LLM_PRIVATE.trustLambda) * trustMatrix[r][s]
        + LLM_PRIVATE.trustLambda * closeness;
    }
  }
}

function executeDecision(
  decision: LLMDecision,
  agent: LLMAgentState,
  book: OrderBook,
  bestBid: number | null,
  bestAsk: number | null,
  fv: number,
) {
  agent.lastAction = decision.action;
  const x = decision.spread;

  switch (decision.action) {
    case 'BUY_NOW':
      if (bestAsk !== null && agent.cash >= bestAsk) {
        book.submitBid(bestAsk + 0.01, agent.id);
      }
      break;
    case 'SELL_NOW':
      if (bestBid !== null && agent.shares > 0) {
        book.submitAsk(bestBid - 0.01, agent.id);
      }
      break;
    case 'BID': {
      const refPrice = bestBid ?? fv * 0.9;
      const price = refPrice * (1 + x);
      if (price > 0 && price <= agent.cash) {
        book.submitBid(price, agent.id);
      }
      break;
    }
    case 'ASK_1': {
      const refPrice = bestAsk ?? fv * 1.1;
      const price = refPrice * (1 - x);
      if (price > 0 && agent.shares > 0) {
        book.submitAsk(price, agent.id);
      }
      break;
    }
    case 'HOLD':
      break;
  }
}

export async function runLLMSession(
  config: SimConfig,
  onProgress?: (p: TickProgress) => void,
  onPeriodComplete?: (period: LLMPeriodRecord) => void,
  abortSignal?: AbortSignal,
): Promise<LLMSessionResult> {
  if (!config.llm) throw new Error('LLM config required for Plan II/III');

  const { nAgents, nRounds, nPeriods, ticksPerPeriod, seed, treatment, plan,
          fv1, endowmentCash, endowmentShares } = config;
  const rng = new PRNG(seed);

  // Pre-generate FV path for stochastic asset classes (no-op for others)
  const fvPath = generateFVPath(seed, config);

  const agents = createAgents(config, rng);
  const trustMatrix = Array.from({ length: nAgents }, () =>
    Array.from({ length: nAgents }, () => 0.5)
  );

  const allPeriods: LLMPeriodRecord[] = [];

  for (let round = 1; round <= nRounds; round++) {
    if (abortSignal?.aborted) break;

    // Reset endowments each round
    for (const agent of agents) {
      agent.cash = Math.round(rng.uniform(endowmentCash[0], endowmentCash[1]));
      agent.shares = rng.choice(endowmentShares);
      agent.belief = computeFV(1, nPeriods, config, fvPath) * (1 + agent.bias);
    }

    // Round 4 replacement
    if (round === 4) {
      const nReplace = treatment === 'R4-2/3' ? Math.round(nAgents / 3) : Math.round(nAgents * 2 / 3);
      const replaceIds = rng.choiceN(nAgents, nReplace);
      for (const idx of replaceIds) {
        const pref = assignRiskPreferences(1, rng, config.riskSplit)[0];
        agents[idx] = {
          id: idx,
          riskPref: pref,
          rho: sampleRho(pref, rng),
          cash: Math.round(rng.uniform(endowmentCash[0], endowmentCash[1])),
          shares: rng.choice(endowmentShares),
          bias: (rng.next() < 0.33 ? 1 : rng.next() < 0.5 ? -1 : 0) * LLM_PRIVATE.biasMagnitude,
          omega: config.experience.omega0,
          belief: computeFV(1, nPeriods, config, fvPath),
          roundsCompleted: 0,
          lastAction: null,
        };
      }
    }

    let lastPrice = computeFV(1, nPeriods, config, fvPath);

    for (let period = 1; period <= nPeriods; period++) {
      if (abortSignal?.aborted) break;

      const fv = computeFV(period, nPeriods, config, fvPath);
      const book = new OrderBook();
      const allTrades: { buyer: number; seller: number; price: number; tick: number }[] = [];
      const periodPrices: number[] = [];

      onProgress?.({
        round, period, tick: 0,
        totalTicks: nRounds * nPeriods,
        status: `R${round} P${period} — calling LLM...`,
      });

      // Call LLM ONCE per period for all agents (period-boundary decision)
      const vwapForPrompt = lastPrice;
      const ctx = {
        period, tick: 1,
        totalPeriods: nPeriods,
        ticksPerPeriod,
        fv,
        bestBid: book.bestBidPrice,
        bestAsk: book.bestAskPrice,
        lastPrices: periodPrices.length > 0 ? periodPrices.slice(-3) : [lastPrice],
        vwap: vwapForPrompt,
        totalShares: agents.reduce((s, a) => s + a.shares, 0),
      };

      const decisionPromises = agents.map(agent => {
        const { system, user } = buildPrompt(plan, agent, ctx, config);
        return callLLM(config.llm!, [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ]);
      });

      const decisions = await Promise.all(decisionPromises);

      // Execute decisions across ticks (replay the period-boundary decision)
      for (let tick = 0; tick < ticksPerPeriod; tick++) {
        if (abortSignal?.aborted) break;

        const bestBid = book.bestBidPrice;
        const bestAsk = book.bestAskPrice;

        // Each tick: a random subset of agents act on their decision
        const order = rng.permutation(nAgents);
        const activeCount = Math.max(2, Math.floor(nAgents * 0.4));
        for (let k = 0; k < activeCount; k++) {
          const idx = order[k];
          const decision = decisions[idx];
          // Market orders only execute once; limit orders can be reposted
          if (tick === 0 || decision.action === 'BID' || decision.action === 'ASK_1') {
            executeDecision(decision, agents[idx], book, bestBid, bestAsk, fv);
          }
        }

        // Match orders
        const matchAgents = agents.map(a => ({ id: a.id, cash: a.cash, shares: a.shares }));
        const trades = book.match(matchAgents as any, tick);
        for (const trade of trades) {
          agents[trade.buyer].cash = matchAgents[trade.buyer].cash;
          agents[trade.buyer].shares = matchAgents[trade.buyer].shares;
          agents[trade.seller].cash = matchAgents[trade.seller].cash;
          agents[trade.seller].shares = matchAgents[trade.seller].shares;
          periodPrices.push(trade.price);
          allTrades.push(trade);
        }
      }

      // Period-end: dividend payment (asset-aware)
      const dividend = generateDividend(rng, config, period, fvPath, nPeriods);
      for (const agent of agents) agent.cash += agent.shares * dividend;

      // Period-end: compute VWAP and update beliefs + trust
      const vwap = periodPrices.length > 0
        ? periodPrices.reduce((a, b) => a + b, 0) / periodPrices.length
        : lastPrice * 0.95;
      lastPrice = vwap;

      updateBeliefs(agents, vwap, fv, config.experience);
      updateTrust(trustMatrix, agents, vwap);

      const periodRecord: LLMPeriodRecord = {
        round, period, fv,
        meanPrice: vwap,
        trades: allTrades,
        agentStates: agents.map(a => ({ ...a })),
        trustMatrix: trustMatrix.map(row => [...row]),
      };
      allPeriods.push(periodRecord);
      onPeriodComplete?.(periodRecord);
    }

    // Round end: learn
    for (const agent of agents) {
      agent.roundsCompleted++;
      agent.omega = computeOmega(agent.roundsCompleted, config.experience);
    }
  }

  return {
    sessionId: config.seed,
    treatment: config.treatment,
    plan: config.plan,
    periods: allPeriods,
  };
}
