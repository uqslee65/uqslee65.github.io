export type LLMAction = 'BUY_NOW' | 'SELL_NOW' | 'BID' | 'ASK_1' | 'HOLD';
export type RiskPreference = 'risk-loving' | 'risk-neutral' | 'risk-averse';
export type PlanType = 'plan-i' | 'plan-ii' | 'plan-iii';

// Alias: Plan and PlanType are identical unions
export type Plan = PlanType;

export type AssetClass =
  | 'linear-declining'
  | 'constant-perpetual'
  | 'linear-growth'
  | 'cyclical'
  | 'random-walk'
  | 'jump-crash';

export type LLMProvider = 'deepseek' | 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'custom';
export type ApiFormat = 'ollama' | 'openai-compat' | 'anthropic' | 'gemini';

export interface LLMAgentState {
  id: number;
  riskPref: RiskPreference;
  rho: number;
  cash: number;
  shares: number;
  bias: number;
  omega: number;
  belief: number;
  roundsCompleted: number;
  lastAction: LLMAction | null;
}

export interface LLMDecision {
  action: LLMAction;
  spread: number;
  reasoning?: string;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxConcurrent: number;
  provider?: LLMProvider;
  apiFormat?: ApiFormat;
}

export interface BoundedRationalityConfig {
  enabled: boolean;
  K: number;      // max reasoning steps (default 3)
  N: number;      // attention slots (default 5)
  T: number;      // memory periods (default 3)
  sigma: number;  // perceived FV noise in cents (default 10)
  p: number;      // execution error probability (default 0.10)
}

export interface RegulatorConfig {
  enabled: boolean;
  threshold: number; // 0-1, mispricing fraction to trigger warning
}

export interface ExperienceCurveConfig {
  alpha0: number;     // novice fundamental weight (default 1.0)
  sigma0: number;     // novice valuation noise (default 5.0)
  omega0: number;     // novice self-weight (default 0.60)
  gammaAlpha: number; // fundamental weight growth (default 0.15)
  gammaSigma: number; // noise decay (default 0.30)
  deltaOmega: number; // self-weight step (default 0.10)
  kMax: number;       // saturation horizon (default 3)
}

export interface HeuristicWeights {
  anchor: number;    // beta1 (default 0.50)
  trend: number;     // beta2 (default 0.20)
  dividend: number;  // beta3 (default 0.20)
  narrative: number; // beta4 (default 0.10)
}

export interface SimConfig {
  plan: PlanType;
  assetClass: AssetClass;
  seed: number;
  nAgents: number;
  nRounds: number;
  nPeriods: number;
  ticksPerPeriod: number;
  dividends: readonly number[];
  expectedDiv: number;
  fv1: number;
  treatment: 'R4-2/3' | 'R4-1/3';
  // fractions summing to 1: [loving, neutral, averse]
  riskSplit: [number, number, number];
  endowmentCash: [number, number];    // U[min, max] in cents
  endowmentShares: number[];          // possible share counts (pick uniformly)
  discountRate: number;               // for perpetual/growth assets
  experience: ExperienceCurveConfig;
  heuristics: HeuristicWeights;
  boundedRationality: BoundedRationalityConfig;
  regulator: RegulatorConfig;
  priorBias: boolean;
  priorNoise: boolean;
  nFundamentalists: number;   // F agents (default 0)
  nTrendFollowers: number;    // T agents (default 0)
  speed: number;              // playback speed ms (default 500)
  llm?: LLMConfig;
}

// --- Shared defaults for sub-configs ---

export const DEFAULT_EXPERIENCE: ExperienceCurveConfig = {
  alpha0: 0.0,
  sigma0: 12.0,
  omega0: 0.90,
  gammaAlpha: 0.15,
  gammaSigma: 0.30,
  deltaOmega: 0.05,
  kMax: 3,
};

export const DEFAULT_HEURISTICS: HeuristicWeights = {
  anchor: 0.30,
  trend: 0.35,
  dividend: 0.20,
  narrative: 0.15,
};

export const DEFAULT_BOUNDED_RATIONALITY: BoundedRationalityConfig = {
  enabled: false,
  K: 3,
  N: 5,
  T: 3,
  sigma: 10,
  p: 0.10,
};

export const DEFAULT_REGULATOR: RegulatorConfig = {
  enabled: false,
  threshold: 0.50,
};

/**
 * DLM_DEFAULTS: matches current engine.ts behavior exactly.
 * N=6 agents, T=10 periods, ticks=10, dividends=[0,20], fv1=100.
 * Note: fv1=100 because FV(period=1) = (10-1+1)*10 = 100.
 */
export const DLM_DEFAULTS: SimConfig = {
  plan: 'plan-i',
  assetClass: 'linear-declining',
  seed: 42,
  nAgents: 6,
  nRounds: 4,
  nPeriods: 10,
  ticksPerPeriod: 10,
  dividends: [0, 20] as const,
  expectedDiv: 10,
  fv1: 100,
  treatment: 'R4-2/3',
  riskSplit: [0.33, 0.34, 0.33],
  endowmentCash: [200, 600],
  endowmentShares: [2, 6],
  discountRate: 0.05,
  experience: DEFAULT_EXPERIENCE,
  heuristics: DEFAULT_HEURISTICS,
  boundedRationality: DEFAULT_BOUNDED_RATIONALITY,
  regulator: DEFAULT_REGULATOR,
  priorBias: true,
  priorNoise: true,
  nFundamentalists: 0,
  nTrendFollowers: 0,
  speed: 500,
};

/**
 * LLM_SCALED_DEFAULTS: matches current llm-engine.ts behavior exactly.
 * N=10 agents, T=20 periods, ticks=18, dividends=[0,10], fv1=100.
 */
export const LLM_SCALED_DEFAULTS: SimConfig = {
  plan: 'plan-ii',
  assetClass: 'linear-declining',
  seed: 42,
  nAgents: 10,
  nRounds: 4,
  nPeriods: 20,
  ticksPerPeriod: 18,
  dividends: [0, 10] as const,
  expectedDiv: 5,
  fv1: 100,
  treatment: 'R4-2/3',
  riskSplit: [0.33, 0.34, 0.33],
  endowmentCash: [800, 1200],
  endowmentShares: [2, 3, 4],
  discountRate: 0.05,
  experience: DEFAULT_EXPERIENCE,
  heuristics: DEFAULT_HEURISTICS,
  boundedRationality: DEFAULT_BOUNDED_RATIONALITY,
  regulator: DEFAULT_REGULATOR,
  priorBias: false,
  priorNoise: false,
  nFundamentalists: 0,
  nTrendFollowers: 0,
  speed: 500,
};

export interface LLMPeriodRecord {
  round: number;
  period: number;
  fv: number;
  meanPrice: number;
  trades: { buyer: number; seller: number; price: number; tick: number }[];
  agentStates: LLMAgentState[];
  trustMatrix: number[][];
}

export interface LLMSessionResult {
  sessionId: number;
  treatment: string;
  plan: PlanType;
  periods: LLMPeriodRecord[];
}

export interface TickProgress {
  round: number;
  period: number;
  tick: number;
  totalTicks: number;
  status: string;
}
