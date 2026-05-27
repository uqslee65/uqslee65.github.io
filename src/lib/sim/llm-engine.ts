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

function createAgents(config: SimConfig, rng: PRNG, nAssets: number): LLMAgentState[] {
  const { nAgents, riskSplit, endowmentCash, endowmentShares, fv1 } = config;
  const prefs = assignRiskPreferences(nAgents, rng, riskSplit);
  const assetConfigs = config.assets ?? [{ id: config.assetClass, weight: 1 }];
  return Array.from({ length: nAgents }, (_, i) => {
    const riskPref = prefs[i];
    const rho = sampleRho(riskPref, rng);
    const biasDir = rng.next() < 0.33 ? 1 : rng.next() < 0.5 ? -1 : 0;
    const baseShares = rng.choice(endowmentShares);
    const sharesPerAsset: number[] = nAssets > 1
      ? assetConfigs.map((ac, j) =>
          j === 0 ? baseShares : Math.max(1, Math.round(rng.choice(endowmentShares) * (ac.weight ?? 1)))
        )
      : undefined as any;  // not used in single-asset path
    return {
      id: i,
      riskPref,
      rho,
      cash: Math.round(rng.uniform(endowmentCash[0], endowmentCash[1])),
      shares: nAssets > 1 ? baseShares : baseShares,
      sharesPerAsset: nAssets > 1 ? sharesPerAsset : undefined,
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
  agentShares?: number,  // explicit share count for this asset (multi-asset path)
) {
  agent.lastAction = decision.action;
  const x = decision.spread;
  // Use explicit share count if provided (multi-asset); fall back to agent.shares (single-asset)
  const shares = agentShares !== undefined ? agentShares : agent.shares;

  switch (decision.action) {
    case 'BUY_NOW':
      if (bestAsk !== null && agent.cash >= bestAsk) {
        book.submitBid(bestAsk + 0.01, agent.id);
      }
      break;
    case 'SELL_NOW':
      if (bestBid !== null && shares > 0) {
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
      if (price > 0 && shares > 0) {
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

  // Resolve asset configs (mirror engine.ts pattern)
  const rawAssetConfigs = config.assets ?? [{ id: config.assetClass, weight: 1 }];
  const nAssets = rawAssetConfigs.length;
  const assetConfigs = nAssets === 1
    ? [{ id: config.assetClass, weight: rawAssetConfigs[0].weight }]
    : rawAssetConfigs;

  // Pre-generate FV paths per asset (seed offset by prime for independence)
  const fvPaths = assetConfigs.map((ac, j) =>
    generateFVPath(seed + j * 7919, { ...config, assetClass: ac.id as any })
  );

  const agents = createAgents(config, rng, nAssets);
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
      if (nAssets > 1) {
        agent.sharesPerAsset = assetConfigs.map((ac, j) =>
          j === 0 ? agent.shares : Math.max(1, Math.round(rng.choice(endowmentShares) * (ac.weight ?? 1)))
        );
      }
      agent.belief = computeFV(1, nPeriods, { ...config, assetClass: assetConfigs[0].id as any }, fvPaths[0]) * (1 + agent.bias);
    }

    // Round 4 replacement
    if (round === 4) {
      const nReplace = treatment === 'R4-2/3' ? Math.round(nAgents / 3) : Math.round(nAgents * 2 / 3);
      const replaceIds = rng.choiceN(nAgents, nReplace);
      for (const idx of replaceIds) {
        const pref = assignRiskPreferences(1, rng, config.riskSplit)[0];
        const baseShares = rng.choice(endowmentShares);
        agents[idx] = {
          id: idx,
          riskPref: pref,
          rho: sampleRho(pref, rng),
          cash: Math.round(rng.uniform(endowmentCash[0], endowmentCash[1])),
          shares: baseShares,
          sharesPerAsset: nAssets > 1
            ? assetConfigs.map((ac, j) =>
                j === 0 ? baseShares : Math.max(1, Math.round(rng.choice(endowmentShares) * (ac.weight ?? 1)))
              )
            : undefined,
          bias: (rng.next() < 0.33 ? 1 : rng.next() < 0.5 ? -1 : 0) * LLM_PRIVATE.biasMagnitude,
          omega: config.experience.omega0,
          belief: computeFV(1, nPeriods, { ...config, assetClass: assetConfigs[0].id as any }, fvPaths[0]),
          roundsCompleted: 0,
          lastAction: null,
        };
      }
    }

    // Per-asset price tracking (mirrors engine.ts runRound pattern)
    const lastPriceByAsset: number[] = assetConfigs.map((_, j) =>
      computeFV(1, nPeriods, { ...config, assetClass: assetConfigs[j].id as any }, fvPaths[j])
    );

    for (let period = 1; period <= nPeriods; period++) {
      if (abortSignal?.aborted) break;

      // Compute FV per asset for this period
      const fvs = assetConfigs.map((ac, j) =>
        computeFV(period, nPeriods, { ...config, assetClass: ac.id as any }, fvPaths[j])
      );

      // Per-asset period trade prices
      const periodPricesPerAsset: number[][] = Array.from({ length: nAssets }, () => []);

      onProgress?.({
        round, period, tick: 0,
        totalTicks: nRounds * nPeriods,
        status: `R${round} P${period} — calling LLM...`,
      });

      // Build market-level asset context (holdings will be filled per-agent below)
      const marketAssets = nAssets > 1
        ? assetConfigs.map((ac, j) => ({
            assetId: ac.id,
            fv: fvs[j],
            bestBid: null as number | null,   // books not yet created; filled later
            bestAsk: null as number | null,
            vwap: lastPriceByAsset[j],
            lastPrices: [lastPriceByAsset[j]],
            holdings: 0,   // placeholder — filled per-agent
          }))
        : undefined;

      // Create one book per asset for this period
      const books = Array.from({ length: nAssets }, () => new OrderBook());

      // Build single-asset backward-compat context values (asset 0)
      const vwapForPrompt = lastPriceByAsset[0];
      const baseCtx = {
        period, tick: 1,
        totalPeriods: nPeriods,
        ticksPerPeriod,
        fv: fvs[0],
        bestBid: books[0].bestBidPrice,
        bestAsk: books[0].bestAskPrice,
        lastPrices: [lastPriceByAsset[0]],
        vwap: vwapForPrompt,
        totalShares: agents.reduce((s, a) => s + a.shares, 0),
      };

      // Call LLM ONCE per period for all agents (period-boundary decision)
      // Per-agent: inject per-asset holdings into context
      const decisionPromises = agents.map(agent => {
        const agentCtx = marketAssets
          ? {
              ...baseCtx,
              assets: marketAssets.map((a, j) => ({
                ...a,
                bestBid: books[j].bestBidPrice,
                bestAsk: books[j].bestAskPrice,
                holdings: agent.sharesPerAsset?.[j] ?? (j === 0 ? agent.shares : 0),
              })),
            }
          : baseCtx;
        const { system, user } = buildPrompt(plan, agent, agentCtx, config);
        return callLLM(config.llm!, [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ]);
      });

      const decisions = await Promise.all(decisionPromises);

      // Capture per-agent reasoning as broadcast messages
      const broadcastMessages: { agentId: number; message: string; tick: number }[] = [];
      decisions.forEach((decision, i) => {
        if (decision.reasoning) {
          agents[i].lastReasoning = decision.reasoning;
          broadcastMessages.push({ agentId: i, message: decision.reasoning, tick: 0 });
        }
      });

      // Per-asset trade collection
      const allTradesByAsset: { buyer: number; seller: number; price: number; tick: number; assetIdx?: number }[][] =
        Array.from({ length: nAssets }, () => []);

      // Execute decisions across ticks (replay the period-boundary decision)
      for (let tick = 0; tick < ticksPerPeriod; tick++) {
        if (abortSignal?.aborted) break;

        if (nAssets === 1) {
          // --- Single-asset tick path (identical to pre-refactor behavior) ---
          const bestBid = books[0].bestBidPrice;
          const bestAsk = books[0].bestAskPrice;

          const order = rng.permutation(nAgents);
          const activeCount = Math.max(2, Math.floor(nAgents * 0.4));
          for (let k = 0; k < activeCount; k++) {
            const idx = order[k];
            const decision = decisions[idx];
            if (tick === 0 || decision.action === 'BID' || decision.action === 'ASK_1') {
              executeDecision(decision, agents[idx], books[0], bestBid, bestAsk, fvs[0]);
            }
          }

          // Single proxy per tick: OrderBook.match reads sharesPerAsset[assetIdx=0]
          const matchAgents = agents.map(a => ({
            id: a.id,
            cash: a.cash,
            shares: a.shares,  // backward-compat scalar
            sharesPerAsset: [a.shares],  // engine.ts match reads sharesPerAsset[0]
          }));
          const trades = books[0].match(matchAgents as any, tick, 0);
          for (const trade of trades) {
            agents[trade.buyer].cash = matchAgents[trade.buyer].cash;
            agents[trade.buyer].shares = matchAgents[trade.buyer].sharesPerAsset[0];
            agents[trade.seller].cash = matchAgents[trade.seller].cash;
            agents[trade.seller].shares = matchAgents[trade.seller].sharesPerAsset[0];
            periodPricesPerAsset[0].push(trade.price);
            allTradesByAsset[0].push(trade);
          }

        } else {
          // --- Multi-asset tick path ---
          const order = rng.permutation(nAgents);
          const activeCount = Math.max(2, Math.floor(nAgents * 0.4));
          for (let k = 0; k < activeCount; k++) {
            const idx = order[k];
            const decision = decisions[idx];
            if (tick === 0 || decision.action === 'BID' || decision.action === 'ASK_1') {
              // Route to the correct book based on assetId in decision
              let j = 0;
              if (decision.assetId) {
                const found = assetConfigs.findIndex(a => a.id === decision.assetId);
                if (found >= 0) j = found;
              }
              const agentShares = agents[idx].sharesPerAsset?.[j] ?? (j === 0 ? agents[idx].shares : 0);
              executeDecision(
                decision, agents[idx], books[j],
                books[j].bestBidPrice, books[j].bestAskPrice,
                fvs[j], agentShares,
              );
            }
          }

          // Match each book with a per-asset proxy (engine.ts pattern)
          for (let j = 0; j < nAssets; j++) {
            // Proxy uses current agent cash + per-asset shares for this book
            const matchAgents = agents.map(a => ({
              id: a.id,
              cash: a.cash,
              shares: a.sharesPerAsset?.[j] ?? (j === 0 ? a.shares : 0),
              sharesPerAsset: [a.sharesPerAsset?.[j] ?? (j === 0 ? a.shares : 0)],
            }));
            const trades = books[j].match(matchAgents as any, tick, 0);
            for (const trade of trades) {
              // Copy back cash (shared) and per-asset shares
              agents[trade.buyer].cash = matchAgents[trade.buyer].cash;
              agents[trade.seller].cash = matchAgents[trade.seller].cash;
              const newBuyerShares = matchAgents[trade.buyer].sharesPerAsset[0];
              const newSellerShares = matchAgents[trade.seller].sharesPerAsset[0];
              if (agents[trade.buyer].sharesPerAsset) {
                agents[trade.buyer].sharesPerAsset![j] = newBuyerShares;
                // Keep scalar shares in sync with asset 0
                if (j === 0) agents[trade.buyer].shares = newBuyerShares;
              } else {
                agents[trade.buyer].shares = newBuyerShares;
              }
              if (agents[trade.seller].sharesPerAsset) {
                agents[trade.seller].sharesPerAsset![j] = newSellerShares;
                // Keep scalar shares in sync with asset 0
                if (j === 0) agents[trade.seller].shares = newSellerShares;
              } else {
                agents[trade.seller].shares = newSellerShares;
              }
              periodPricesPerAsset[j].push(trade.price);
              allTradesByAsset[j].push({ ...trade, assetIdx: j });
            }
          }
        }
      }

      // Period-end: dividend payment
      if (nAssets > 1) {
        for (let j = 0; j < nAssets; j++) {
          const div = generateDividend(rng, { ...config, assetClass: assetConfigs[j].id as any }, period, fvPaths[j], nPeriods);
          for (const agent of agents) {
            const holdings = agent.sharesPerAsset?.[j] ?? (j === 0 ? agent.shares : 0);
            agent.cash += holdings * div;
          }
        }
      } else {
        const dividend = generateDividend(rng, config, period, fvPaths[0], nPeriods);
        for (const agent of agents) agent.cash += agent.shares * dividend;
      }

      // Period-end: compute VWAP per asset, update beliefs + trust using asset 0
      const vwapsThisPeriod = assetConfigs.map((_, j) => {
        const prices = periodPricesPerAsset[j];
        return prices.length > 0
          ? prices.reduce((a, b) => a + b, 0) / prices.length
          : lastPriceByAsset[j] * 0.95;
      });
      for (let j = 0; j < nAssets; j++) {
        lastPriceByAsset[j] = vwapsThisPeriod[j];
      }

      const vwap0 = vwapsThisPeriod[0];
      updateBeliefs(agents, vwap0, fvs[0], config.experience);
      updateTrust(trustMatrix, agents, vwap0);

      // Flatten all trades for backward-compat top-level field
      const allTrades = allTradesByAsset.flat();

      const periodRecord: LLMPeriodRecord = {
        round, period,
        fv: fvs[0],
        meanPrice: vwap0,
        trades: allTrades,
        agentStates: agents.map(a => ({
          ...a,
          sharesPerAsset: a.sharesPerAsset ? [...a.sharesPerAsset] : undefined,
        })),
        trustMatrix: trustMatrix.map(row => [...row]),
        broadcastMessages: broadcastMessages.length > 0 ? broadcastMessages : undefined,
        ...(nAssets > 1 ? {
          assets: assetConfigs.map((ac, j) => ({
            assetId: ac.id,
            fv: fvs[j],
            meanPrice: vwapsThisPeriod[j],
            trades: allTradesByAsset[j],
          })),
        } : {}),
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
