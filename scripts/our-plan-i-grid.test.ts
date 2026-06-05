/**
 * OUR-side Plan I grid runner for the m0nius reconciliation.
 *
 * Runs our vendored zigan-simulation engine across the SAME 22 configs swept on m0nius
 * (docs/m0nius-results/plan-i-m0nius.json), 10 seeds each, and writes per-round meanDev +
 * turnover computed IDENTICALLY to m0nius (mean over a round's trades of |trade.price - fv|;
 * turnover = trades / (N*3)). Plus an ours-only alpha0 micro-sweep for the calibration-lever
 * offset overlay. Output: docs/m0nius-results/plan-i-ours.json.
 *
 * Run: npx vitest run scripts/our-plan-i-grid.test.ts -c scripts/vitest.grid.config.mts
 */
import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runSession } from '../node_modules/zigan-simulation/src/lib/sim/engine';
import { DLM_DEFAULTS, type SimConfig, type AssetClass } from '../node_modules/zigan-simulation/src/lib/sim/types';

const SEEDS = Array.from({ length: 10 }, (_, i) => 1 + i * 97);

const ASSET_MAP: Record<string, AssetClass> = {
  linearDeclining: 'linear-declining',
  constantPerpetual: 'constant-perpetual',
  linearGrowth: 'linear-growth',
  cyclicalSine: 'cyclical',
  randomWalk: 'random-walk',
  jumpCrash: 'jump-crash',
};

// The 22 m0nius configs, expressed as overrides (mirrors the in-browser grid).
const GRID = [
  { id: 'g01', label: 'baseline (default)', over: {} },
  { id: 'g02', label: 'alpha0=0.5', over: { alpha0: 0.5 } },
  { id: 'g03', label: 'alpha0=1.5', over: { alpha0: 1.5 } },
  { id: 'g04', label: 'alpha0=2.0', over: { alpha0: 2.0 } },
  { id: 'g05', label: 'sigma0=2', over: { sigma0: 2 } },
  { id: 'g06', label: 'sigma0=10', over: { sigma0: 10 } },
  { id: 'g07', label: 'omega0=0.3', over: { omega0: 0.3 } },
  { id: 'g08', label: 'omega0=0.9', over: { omega0: 0.9 } },
  { id: 'g09', label: 'gammaAlpha=0.05', over: { gammaAlpha: 0.05 } },
  { id: 'g10', label: 'gammaAlpha=0.30', over: { gammaAlpha: 0.30 } },
  { id: 'g11', label: 'gammaSigma=0.15', over: { gammaSigma: 0.15 } },
  { id: 'g12', label: 'gammaSigma=0.50', over: { gammaSigma: 0.50 } },
  { id: 'g13', label: 'N=6', over: { nAgents: 6 } },
  { id: 'g14', label: 'N=20', over: { nAgents: 20 } },
  { id: 'g15', label: 'rate=0.333 (replace 1/3)', over: { rate: 0.333 } },
  { id: 'g16', label: 'rate=0.667 (replace 2/3)', over: { rate: 0.667 } },
  { id: 'g17', label: 'asset=constantPerpetual', over: { asset: 'constantPerpetual' } },
  { id: 'g18', label: 'asset=linearGrowth', over: { asset: 'linearGrowth' } },
  { id: 'g19', label: 'asset=cyclicalSine', over: { asset: 'cyclicalSine' } },
  { id: 'g20', label: 'asset=randomWalk', over: { asset: 'randomWalk' } },
  { id: 'g21', label: 'risk loving-heavy 70/15/15', over: { riskSplit: [0.70, 0.15, 0.15] } },
  { id: 'g22', label: 'risk averse-heavy 15/15/70', over: { riskSplit: [0.15, 0.15, 0.70] } },
] as const;

function buildConfig(over: any, seed: number): SimConfig {
  const exp = { ...DLM_DEFAULTS.experience };
  if (over.alpha0 != null) exp.alpha0 = over.alpha0;
  if (over.sigma0 != null) exp.sigma0 = over.sigma0;
  if (over.omega0 != null) exp.omega0 = over.omega0;
  if (over.gammaAlpha != null) exp.gammaAlpha = over.gammaAlpha;
  if (over.gammaSigma != null) exp.gammaSigma = over.gammaSigma;
  const cfg: SimConfig = { ...DLM_DEFAULTS, seed, experience: exp };
  if (over.nAgents) cfg.nAgents = over.nAgents;
  if (over.asset) cfg.assetClass = ASSET_MAP[over.asset];
  if (over.riskSplit) cfg.riskSplit = over.riskSplit;
  // rate -> treatment enum. 0.667 -> R4-1/3 (replace 2/3); else R4-2/3 (replace 1/3).
  const rate = over.rate ?? 0.5;
  cfg.treatment = rate >= 0.6 ? 'R4-1/3' : 'R4-2/3';
  return cfg;
}

// Per-round meanDev (mean over trades of |price - fv|) + turnover (trades / (N*3)), m0nius-identical.
function perRound(res: any, nAgents: number) {
  const out: Record<number, { dev: number; turn: number; trades: number }> = {};
  for (const rd of [1, 2, 3, 4]) {
    const ps = res.periods.filter((p: any) => p.round === rd);
    let absSum = 0, n = 0, trades = 0;
    for (const p of ps) {
      for (const t of p.trades) { absSum += Math.abs(t.price - p.fv); n++; }
      trades += p.trades.length;
    }
    out[rd] = {
      dev: n ? Math.round((absSum / n) * 100) / 100 : 0,
      turn: Math.round((trades / (nAgents * 3)) * 100) / 100,
      trades,
    };
  }
  return out;
}

function avgConfig(over: any) {
  const nAgents = over.nAgents ?? DLM_DEFAULTS.nAgents;
  const acc: Record<number, { dev: number[]; turn: number[] }> = { 1: { dev: [], turn: [] }, 2: { dev: [], turn: [] }, 3: { dev: [], turn: [] }, 4: { dev: [], turn: [] } };
  let error: string | null = null;
  for (const seed of SEEDS) {
    try {
      const res = runSession(buildConfig(over, seed), seed);
      const pr = perRound(res, nAgents);
      for (const rd of [1, 2, 3, 4]) { acc[rd].dev.push(pr[rd].dev); acc[rd].turn.push(pr[rd].turn); }
    } catch (e: any) { error = String(e?.message || e); break; }
  }
  if (error) return { error };
  const mean = (a: number[]) => Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100;
  const per: any = {};
  for (const rd of [1, 2, 3, 4]) per[rd] = { dev: mean(acc[rd].dev), turn: mean(acc[rd].turn) };
  return { per };
}

it('runs the ours-side Plan I grid and writes plan-i-ours.json', () => {
  const results = GRID.map(g => ({ id: g.id, label: g.label, rate: (g.over as any).rate ?? 0.5, ...avgConfig(g.over) }));

  // ours-only alpha0 micro-sweep (calibration-lever offset overlay): R1 meanDev vs alpha0.
  const alphaSweep = [0.2, 0.4, 0.6, 0.8, 1.0, 1.5].map(a => {
    const r = avgConfig({ alpha0: a }) as any;
    return { alpha0: a, R1: r.per?.[1]?.dev ?? null, R3: r.per?.[3]?.dev ?? null };
  });

  const payload = {
    _meta: {
      source: 'OUR engine — vendored zigan-simulation 1.0.5 (node_modules/zigan-simulation/src/lib/sim)',
      generatedAt: '2026-06-06',
      plan: 'I (algorithmic; structural partial-adjustment bubble)',
      seeds: SEEDS,
      method: 'runSession() per seed; per-round meanDev = mean over the round trades of |trade.price - period.fv|; turnover = trades/(N*3); averaged over 10 seeds. IDENTICAL meanDev definition to m0nius.',
      ours_defaults: { alpha0: DLM_DEFAULTS.experience.alpha0, gammaAlpha: DLM_DEFAULTS.experience.gammaAlpha, sigma0: DLM_DEFAULTS.experience.sigma0, omega0: DLM_DEFAULTS.experience.omega0, gammaSigma: DLM_DEFAULTS.experience.gammaSigma, priorBias: DLM_DEFAULTS.priorBias },
      caveats: [
        'CALIBRATION LEVERS: ours alpha0 default=0.6, m0nius=1.0; ours gammaAlpha=0.09, m0nius=0.15. For g02-g04/g09-g10 ours is set to the SAME ABSOLUTE value m0nius used, so absolute deltas there are NOT apples-to-apples — see alphaSweep for the offset overlay.',
        'TREATMENT: ours has a 2-level enum (replace 1/3 = R4-2/3, replace 2/3 = R4-1/3). m0nius default rate=0.5 has no exact counterpart -> R4 at rate 0.5 (g01-g14,g17-g22) is NOT exactly comparable. R1-R3 are pre-replacement and always comparable. g15 (0.333->R4-2/3) and g16 (0.667->R4-1/3) are exact.',
        'priorBias kept at ours default (false) — NOT flipped to match m0nius (true). The two engines match at the tuned point via different internal mechanisms.',
      ],
    },
    results,
    alphaSweep,
  };
  const outPath = resolve(__dirname, '../docs/m0nius-results/plan-i-ours.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log('WROTE', outPath);
  console.log('baseline ours per-round:', JSON.stringify(results[0]));
  expect(results.length).toBe(22);
});
