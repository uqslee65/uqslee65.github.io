export const TOOLTIPS: Record<string, string> = {
  'asset.linear-declining': 'Classic SSW: FV falls to 0 as dividends run out',
  'asset.constant-perpetual': 'Gordon growth g=0: constant FV throughout session',
  'asset.linear-growth': 'Gordon perpetuity on rising dividend: FV = (2 + 0.3t) / r',
  'asset.cyclical': 'Gordon perpetuity on cyclical dividend: FV = (5 + 2sin(2π(t-1)/10)) / r',
  'asset.random-walk': 'Pre-seeded Gaussian random walk around fv1',
  'asset.jump-crash': 'Calm drift with 10% chance of a −30 crash each period',

  'exp.alpha0': 'Novice fundamental weight — weight on model-based FV in the prior blend',
  'exp.sigma0': 'Novice valuation noise — Gaussian half-width shrinks with experience',
  'exp.omega0': 'Novice self-weight — trust in own prior vs. the market',
  'exp.gammaAlpha': 'Fundamental weight growth rate per round of experience',
  'exp.gammaSigma': 'Noise decay rate per round of experience',

  'risk.loving': 'CRRA ρ ∈ (−1, 0). Convex utility; upside-dominated. Primary bubble fuel.',
  'risk.neutral': 'CRRA ρ = 0. Linear utility; prices at expected value. Pulls toward FV.',
  'risk.averse': 'CRRA ρ ∈ (0, 1). Concave utility; downside-dominated. Suppresses bubbles.',

  'trade.fundamentalists': 'N(F) — Background mean-reversion agents anchored on FV. Set to 0 to remove the rational anchor.',
  'trade.trendFollowers': 'N(T) — Momentum/positive-feedback traders. Set to 0 to remove the trend-following channel.',

  'metrics.title': 'DLM (2005) Table 2 — Haessel R², Normalized Abs/Avg Deviation, Amplitude',

  'constants.paper': 'Original DLM (2005) paper parameters for reference',
  'constants.impl': 'Simulator implementation constants — not from the paper',
};

export const FIGURE_TOOLTIPS: Record<string, string> = {
  fig1: 'Bubble metrics compared to DLM (2005) Table 2 published values. Delta shows percentage divergence.',
  fig2: 'Signed mispricing (P̄ − FV)/FV across periods. Positive = bubble, negative = crash.',
  fig3: 'Number of executed trades per period. Low volume + high mispricing = thin-market bubble.',
  fig4: 'Heatmap of trade price density across periods. Darker = more trades at that price.',
  fig5: 'Per-agent action timeline: BUY/SELL/HOLD decisions each period.',
  fig6: 'Subjective valuations vs FV — shows belief convergence (Plan I only).',
  fig7: 'Normalized utility by agent. CRRA utility of terminal wealth relative to initial endowment.',
  fig8: 'Asset ownership concentration over time. Shows share distribution across agents.',
  fig9: 'Broadcast messages between agents — social influence channel (Plan I only).',
  fig10: 'Trust matrix: agent-to-agent trust weights. Lighter = higher trust.',
  fig11: 'Realized P&L per agent across periods.',
  fig12: 'Per-agent subjective valuation trajectories over time.',
};
