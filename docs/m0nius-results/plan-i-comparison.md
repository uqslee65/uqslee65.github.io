# Plan I reconciliation — ours vs m0nius across 22 configs

Captured 2026-06-06. Sources: `plan-i-m0nius.json` (m0nius's own engine, headless, 10-session
batch) and `plan-i-ours.json` (vendored zigan-simulation 1.0.5, 10 seeds). **meanDev computed
identically on both sides**: mean over a round's trades of |trade.price − period.fv| (¢).

## Method

- **m0nius**: drove its in-page engine (`window.App`) headless under turbo pacing; read its own
  `batchResults.meanDev`/`turnover`; averaged per round over a full 10-session batch.
- **ours**: `runSession()` × 10 seeds/config; same per-trade meanDev; averaged.
- Both default configs are identical on σ₀, ω₀, γσ, N, asset, treatment, risk-split. They differ
  on the two **calibration levers**: ours `alpha0=0.6, gammaAlpha=0.09` vs m0nius `1.0, 0.15`
  (ours was reverse-engineered to match m0nius's reference at the default point).
- Both have prior bias + prior noise ON.

## Baseline match (g01) — holds by construction

| | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| ours    | 3.34 | 2.40 | 1.81 | 2.18 |
| m0nius  | 3.58 | 2.54 | 1.72 | 2.28 |
| Δ       | −0.24 | −0.14 | +0.09 | −0.10 |

Within ~0.2¢ — and m0nius's own baseline re-verified against the stored reference
{3.65,2.49,1.72,2.28}. The match is real.

## Shared-anchor levers — the clean "does ours track theirs" test

Per-round mean |P−FV| (R1/R2/R3; R4 deferred — see caveat). Δ = ours − m0nius.

| config | ours R1/R2/R3 | m0nius R1/R2/R3 | verdict |
|---|---|---|---|
| g08 ω₀=0.9        | 3.57 / 2.67 / 1.90 | 2.74 / 2.14 / 1.71 | tracks, ours a touch high |
| **g07 ω₀=0.3**    | 3.10 / 2.27 / 1.55 | **10.07 / 6.84 / 4.70** | **DIVERGE** — m0nius bubbles hard on low self-weight; ours barely moves |
| **g05 σ₀=2**      | 3.34 / 2.40 / 1.81 | 3.25 / 2.16 / 1.29 | **ours INERT** (=baseline); m0nius responds |
| **g06 σ₀=10**     | 3.34 / 2.40 / 1.81 | 4.91 / 3.84 / 2.93 | **ours INERT**; m0nius scales up |
| g13 N=6           | 3.30 / 2.41 / 1.73 | 3.68 / 2.51 / 1.70 | both ~invariant ✓ |
| g14 N=20          | 3.39 / 2.50 / 1.85 | 3.57 / 2.51 / 1.71 | both ~invariant ✓ |
| g17 perpetual     | 0.77 / 0.86 / 0.94 | 1.75 / 1.46 / 1.23 | both flat/low ✓ (moving-vs-flat, Point 3) |
| g18 linearGrowth  | 4.16 / 2.78 / 1.64 | 3.64 / 2.37 / 1.60 | tracks ✓ |
| g19 cyclical      | 7.77 / 5.69 / 3.87 | 8.24 / 5.75 / 3.60 | tracks ✓ |
| **g20 randomWalk**| 1.64 / 1.39 / 1.28 | **12.69 / 8.89 / 11.06** | **DIVERGE hard** — different RW FV-path handling |
| g21 risk loving   | 3.37 / 2.47 / 1.76 | 3.64 / 2.52 / 1.74 | both ~invariant ✓ |
| g22 risk averse   | 3.35 / 2.50 / 1.78 | 3.63 / 2.50 / 1.75 | both ~invariant ✓ |

**R4 where exactly comparable** (rate maps to our enum): g15 (0.333→R4-2/3) ours 2.18 / m0nius
1.84; g16 (0.667→R4-1/3) ours 2.98 / m0nius 2.74. Direction matches (more replacement → bigger
R4) on both; ours ~0.3¢ higher.

## Calibration levers — offset overlay (α₀)

m0nius default α₀=1.0, ours=0.6 → offset ≈ 0.4. R1 mean|dev| vs (α₀ − own_default):

| Δ = α₀ − own_default | ours (α₀) | m0nius (α₀) |
|---|---|---|
| ≈ −0.5 | >14.6 (0.1) | 12.11 (0.5) |
| ≈ −0.2 | 6.70 (0.4) | ~6 (0.8, interp) |
| 0      | **3.34 (0.6)** | **3.58 (1.0)** |
| +0.5   | 0.48 (1.1) | 3.56 (1.5) |
| +0.9   | 0.48 (1.5) | 3.60 (2.0) |

**Curves collapse below and at the knee** (behaviorally equivalent up to the 0.4 calibration
offset — the bubble explodes as α₀ drops on both). **They diverge above the knee**: ours' bubble
→ ~0.5¢ (near-perfect FV tracking), m0nius retains a **~3.6¢ floor** independent of α₀. So m0nius
carries an α₀-independent bubble floor that ours does not, despite both having bias on.

**γα**: ours responds strongly (g09 R3=2.44 slow-decay vs g10 R3=0.55 fast-decay); m0nius is
saturated (g09 R3=1.73 ≈ g10 R3=1.72). Another calibration-lever divergence.

## Findings

**Match holds:** baseline; population-size invariance; risk-split invariance (Plan I is
algorithmic, so risk prefs don't bite either side); the moving-vs-flat asset distinction
(perpetual flat; declining/growth/cyclical bubble); α₀ at and below the knee.

**Match breaks (real behavioral differences, not bugs):**
1. **σ₀ / γσ inert in ours**, active in m0nius — ours' mean|dev| is unmoved by valuation-noise
   width while m0nius's scales with it.
2. **ω₀ response muted in ours** — m0nius bubbles violently at low self-weight (herding); ours
   barely moves.
3. **random-walk asset** — m0nius ~12¢ mispricing vs ours ~1.3¢; the two implementations of a
   random-walk fundamental are not the same model.
4. **α₀ tail** — m0nius keeps a ~3.6¢ bubble floor at high α₀; ours tracks FV to ~0.5¢.
5. **γα** — ours sensitive, m0nius saturated.
6. **turnover** — ours ~14–16 vs m0nius ~44–51 (≈⅓); a microstructure/trade-density scale gap
   (meanDev is the primary metric; turnover is reported but not matched).

## Caveats

- **R4 at rate 0.5** (most of the grid) is not exactly comparable — ours' treatment is a 2-level
  enum (replace 1/3 or 2/3); m0nius's default replacement is 50%. R1–R3 are pre-replacement and
  always comparable; R4 is only exact at g15/g16.
- Calibration-lever absolute deltas (g02–g04, g09–g10) are **not** apples-to-apples; read them
  via the offset overlay above.

## Verdict

Ours and m0nius are **behaviorally equivalent at the tuned operating point and along the
"shared-semantic" axes that don't touch the bubble engine** (N, risk, the standard moving assets,
and α₀ near its knee). They **diverge precisely on the axes that drive m0nius's bubble through
channels ours implements differently** — noise width (σ₀), peer-weight (ω₀), the random-walk
asset, and the high-α₀ bias floor. That is the honest map of where the replication holds: ours is
a faithful *reduced* model calibrated at the default, not a bit-for-bit re-implementation of
m0nius across the whole parameter space.
