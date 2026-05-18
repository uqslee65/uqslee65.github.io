import type { LLMAgentState, PlanType, SimConfig, BoundedRationalityConfig, RegulatorConfig, AssetClass } from './types';

interface MarketContext {
  period: number;
  tick: number;
  totalPeriods: number;
  ticksPerPeriod: number;
  fv: number;
  bestBid: number | null;
  bestAsk: number | null;
  lastPrices: number[];
  vwap: number;
  totalShares: number;
}

const MARKET_RULES = `You are a trader in an experimental asset market.
- The asset lives for T periods. At each period end, it pays a dividend of 0¢ or 10¢ (equal probability, expected 5¢).
- Fundamental value at period t: FV_t = (T - t + 1) × 5¢. The asset expires worthless after period T.
- You trade via a continuous double auction. Each tick you choose ONE action.
- Your goal: maximize your final wealth (cash + shares × current_value).`;

const DECISION_PRINCIPLES = `Decision principles:
- BUY_NOW: immediately buy 1 share at the current best ask price (market order)
- SELL_NOW: immediately sell 1 share at the current best bid price (market order)
- BID: post a limit buy order at bestBid × (1 + spread), improving the bid
- ASK_1: post a limit sell order at bestAsk × (1 - spread), improving the ask
- HOLD: do nothing this tick
- spread: a number between 0.01 and 0.10 (1% to 10%) that determines how aggressively your limit order improves the current best quote`;

const RESPONSE_FORMAT = `Respond with ONLY a raw JSON object. No markdown, no code blocks, no explanation outside the JSON:
{"action": "BUY_NOW|SELL_NOW|BID|ASK_1|HOLD", "spread": 0.05, "reasoning": "brief reason"}`;

function planIISystemPrompt(agent: LLMAgentState): string {
  const rhoStr = agent.rho.toFixed(3);
  const utilityFn = agent.rho === 0
    ? 'U(w) = ln(w)  (risk-neutral, log utility)'
    : `U(w; ρ=${rhoStr}) = w^(1-${rhoStr}) / (1 - ${rhoStr})`;

  const roleGuidance = agent.riskPref === 'risk-loving'
    ? `You are RISK-LOVING (ρ=${rhoStr} < 0). Your utility is convex — you prefer gambles over sure things. You should be willing to buy at prices above fundamental value if you believe prices will rise further. You tolerate large swings.`
    : agent.riskPref === 'risk-neutral'
    ? `You are RISK-NEUTRAL (ρ=0). Your utility is linear — you evaluate trades purely by expected monetary value. Buy when price < your expected value, sell when price > your expected value.`
    : `You are RISK-AVERSE (ρ=${rhoStr} > 0). Your utility is concave — you prefer certainty over gambles of equal expected value. You should demand a discount to buy and be willing to sell at or slightly below fundamental value. Avoid concentrated positions.`;

  return `${MARKET_RULES}

${DECISION_PRINCIPLES}

## Your Utility Function (CRRA)
${utilityFn}

## Your Role
${roleGuidance}

## Expected Utility Calculation
For a market buy at price p: EU = probability_of_gain × U(wealth + gain) + (1 - p_gain) × U(wealth - cost)
For a passive bid at price p: EU = p_fill × U(wealth_if_filled) + (1 - p_fill) × U(current_wealth)
where p_fill ≈ 0.30 (probability a passive order gets filled).

${RESPONSE_FORMAT}`;
}

function planIIISystemPrompt(agent: LLMAgentState): string {
  const label = agent.riskPref === 'risk-loving'
    ? 'You are a RISK-LOVING trader. You enjoy taking big positions, riding momentum, and are comfortable with large swings in your portfolio value. You tend to buy into rising markets and hold through volatility.'
    : agent.riskPref === 'risk-neutral'
    ? 'You are a RISK-NEUTRAL trader. You make decisions based purely on expected value — if the price is below what you think the asset is worth, you buy; if above, you sell. No emotional attachment to positions.'
    : 'You are a RISK-AVERSE trader. You prefer to protect your capital. You sell early to lock in gains, demand discounts before buying, and keep cash reserves. You avoid large concentrated bets.';

  return `${MARKET_RULES}

${DECISION_PRINCIPLES}

## Your Risk Profile
${label}

${RESPONSE_FORMAT}`;
}

function buildUserMessage(agent: LLMAgentState, ctx: MarketContext): string {
  const wealth = agent.cash + agent.shares * ctx.fv;
  const recentPrices = ctx.lastPrices.length > 0
    ? ctx.lastPrices.map(p => p.toFixed(1)).join(', ')
    : 'none yet';

  return `Period ${ctx.period}/${ctx.totalPeriods}, Tick ${ctx.tick}/${ctx.ticksPerPeriod}
FV = ${ctx.fv.toFixed(1)}¢ (declining 5¢/period)
Your cash: ${agent.cash.toFixed(1)}¢ | Your shares: ${agent.shares} | Wealth: ${wealth.toFixed(1)}¢
Best bid: ${ctx.bestBid?.toFixed(1) ?? 'none'} | Best ask: ${ctx.bestAsk?.toFixed(1) ?? 'none'}
Recent trade prices: ${recentPrices}
Your belief (subjective value): ${agent.belief.toFixed(1)}¢
VWAP this period: ${ctx.vwap.toFixed(1)}¢`;
}

export function buildPrompt(
  plan: PlanType,
  agent: LLMAgentState,
  ctx: MarketContext,
): { system: string; user: string } {
  const system = plan === 'plan-ii'
    ? planIISystemPrompt(agent)
    : planIIISystemPrompt(agent);
  const user = buildUserMessage(agent, ctx);
  return { system, user };
}

// ---------------------------------------------------------------------------
// Phase B8: additional prompt-building utilities
// ---------------------------------------------------------------------------

/**
 * Appends cognitive-constraint instructions when bounded rationality is enabled.
 * Caller should append this to the system prompt string.
 */
export function buildBoundedRationalityBlock(config: { boundedRationality: BoundedRationalityConfig }): string {
  const br = config.boundedRationality;
  if (!br.enabled) return '';
  return `
COGNITIVE CONSTRAINTS (Bounded Rationality):
- You can reason through at most K=${br.K} steps before deciding.
- You can attend to at most N=${br.N} pieces of information simultaneously.
- You remember only the last T=${br.T} periods of price history.
- Your perception of fundamental value has noise σ=${br.sigma}¢.
- With probability p=${br.p}, your intended action will be randomly replaced.
Pick one heuristic for this decision: trend-following | mean-reversion | anchoring | randomized.`;
}

/**
 * Prepends a regulatory alert when mispricing exceeds the configured threshold.
 * Caller should prepend this to the user prompt string when applicable.
 */
export function buildRegulatorWarning(
  config: { regulator: RegulatorConfig },
  mispricingFraction: number,
  periodSinceMispricing: number,
): string {
  const reg = config.regulator;
  if (!reg.enabled) return '';
  if (mispricingFraction < reg.threshold) return '';
  const pct = (mispricingFraction * 100).toFixed(1);
  return `⚠️ REGULATORY ALERT: Current market price deviates ${pct}% from fundamental value. This mispricing has persisted since period ${periodSinceMispricing}. Exercise heightened caution in your trading decisions.\n\n`;
}

/**
 * Returns a 1–2 sentence description of the current asset's dividend/FV structure.
 */
export function assetEnvironmentBlock(config: { assetClass: AssetClass; nPeriods: number }): string {
  const T = config.nPeriods;
  switch (config.assetClass) {
    case 'linear-declining':
      return `This asset has a finite life of ${T} periods. Each period it pays a dividend of 0 or 10¢ (equal probability). Fundamental value declines linearly: FV_t = 5·(${T}-t+1).`;
    case 'constant-perpetual':
      return `This asset lives forever. Each period it pays 4 or 6¢ (expected 5¢). Discount rate = 5%. Fundamental value = 100¢ (constant).`;
    case 'linear-growth':
      return `This asset has a finite life of ${T} periods. The expected dividend grows by 1¢ each period. Fundamental value increases over time as dividends compound.`;
    case 'cyclical':
      return `This asset has a finite life of ${T} periods. The dividend alternates between high (10¢) and low (2¢) phases, creating a cyclical fundamental value profile.`;
    case 'random-walk':
      return `This asset has a finite life of ${T} periods. The fundamental value follows a random walk seeded each round; there is no predictable trend to exploit.`;
    case 'jump-crash':
      return `This asset has a finite life of ${T} periods. The fundamental value is stable most periods, but a latent crash event — randomly scheduled — can wipe out value instantly.`;
  }
}

/**
 * Returns a formatted block summarising the current simulation parameters.
 */
export function buildParameterBlock(
  config: SimConfig,
  round: number,
  period: number,
): string {
  const nUtility = config.nAgents - config.nFundamentalists - config.nTrendFollowers;
  const [lovingFrac, neutralFrac, averseFrac] = config.riskSplit;
  return `SIMULATION PARAMETERS:
- Agents: ${config.nAgents} (${config.nFundamentalists} fundamentalist, ${config.nTrendFollowers} trend-follower, ${nUtility} utility)
- Risk composition: ${(lovingFrac * 100).toFixed(0)}% loving, ${(neutralFrac * 100).toFixed(0)}% neutral, ${(averseFrac * 100).toFixed(0)}% averse
- Round ${round} of ${config.nRounds}, Period ${period} of ${config.nPeriods}`;
}
