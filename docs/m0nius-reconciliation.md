# m0nius Reconciliation — Scope & Spec

**Canonical reference for the DLM bubble-simulator matching effort.** Read this before any
m0nius work — do **not** re-derive the URL, the config surface, or what has/hasn't been
validated. If something here is stale, fix it here.

Last verified surface: 2026-06-06 (live, via Playwright).

---

## 1. Canonical facts

| Thing | Value |
|---|---|
| Reference platform | **https://assets.m0nius.com/** (page title: *"Virtual Trading Platform"*) |
| Our engine | vendored npm pkg **`zigan-simulation`** → `node_modules/zigan-simulation/src/lib/sim/` |
| Current vendored version | 1.0.5 |
| Source paper | Dufwenberg, Lindqvist & Moore (2005) — "DLM" |
| Walkthrough reference data | `node_modules/zigan-simulation/src/components/walkthrough/referenceData.ts` |
| Replication tests | `node_modules/zigan-simulation/src/lib/sim/__tests__/replication.test.ts` |

### Three research plans (exist on BOTH platforms)
- **Plan I** — algorithmic belief rule, no LLM. Deterministic given seed.
- **Plan II** — LLM agents with the CRRA utility function in the prompt.
- **Plan III** — LLM agents with a risk *label* only (utility omitted from the prompt).

---

## 2. m0nius UI surface (verified 2026-06-06)

- **Tabs**: Experiment · Architecture · Glossary · Slides · Analytics
- **Plan switch**: Plan I / Plan II / Plan III buttons
- **Run controls**: ▶ Start · ⏸ Pause · ↺ Reset · ⬇ **Export** · Speed slider (default **×14**)
- **Batch**: built-in **10-session batch** (S1…S10 chips). m0nius is **stochastic (no seed)** →
  its reported per-round numbers are **10-session batch averages**, not single runs.
- Live status panel: Session /10 · Round /4 · Period /20 · Tick · Price · Fundamental ·
  Mispricing · Volume·period.
- Agents panel: per-agent ρᵢ, cash, shares, wealth, CRRA utility, αᵢ, σᵢ, ωᵢ, "View Stats",
  "View Prompt" (Plan I → *"algorithmic decision rules. No LLM prompt is generated."*).

---

## 3. Config mapping (m0nius control ↔ our `SimConfig`)

`SimConfig` lives in `node_modules/zigan-simulation/src/lib/sim/types.ts`; defaults in
`DLM_DEFAULTS`. Verified m0nius defaults shown.

| m0nius control | default | our `SimConfig` field | notes |
|---|---|---|---|
| Plan I/II/III | Plan I | `plan: 'plan-i'\|'plan-ii'\|'plan-iii'` | |
| Population N | 10 | `nAgents` | ⚠️ N(F)/N(T) tooltips say *"fixed N = 100"* — possible internal scale ≠ our N=10. **OPEN.** |
| Rounds per session R | 4 | `nRounds` | |
| Replacement round r | 4 | (treatment timing) | |
| Periods | 20 | `nPeriods` | |
| Fundamentalists N(F) | 0 | `nFundamentalists` | |
| Trend followers N(T) | 0 | `nTrendFollowers` | |
| Risk split (loving/neutral/averse) | 33/34/33% | (CRRA ρ draw) | loving ρ∼U(−1,0), neutral ρ=0, averse ρ∼U(0,1) |
| α₀ fundamental weight | **1.00** | `alpha0` | |
| σ₀ noise | **5.0** | `sigma0` | |
| ω₀ self (non-peer) weight | **0.60** | `omega0` | |
| γα growth | **0.15** | `gammaAlpha` | |
| γσ decay | **0.30** | `gammaSigma` | |
| β1 anchor | 0.50 | utility `anchor` | |
| β2 trend | 0.20 | utility `trend` | |
| β3 dividend | 0.20 | utility `dividend` | |
| β4 narrative | 0.10 | utility `narrative` | Σβ = 1.00 |
| Prior Bias toggle | on | `bias` | our match-engine sets bias 0 (structural bubble); m0nius default ON — **OPEN: reconcile** |
| Prior Noise toggle | on | `valuationNoise` (±3%) | |
| Per-session replacement rate | 50% | `treatment` (R4-2/3 ≈ 50%) | grid S1…S10 |
| Pre/Post asset + corr | Linear Declining→same, corr 1.00 | `assetClass`, `postAssetClass` | |

### Asset classes
m0nius: Linear Declining (DLM) · Perpetual · Linear Growth · Cyclical ·
**Random Walk Fundamental** · **Jump / Crash**.
Ours (`AssetClass`): linear-declining · constant-perpetual · linear-growth · cyclical · …
⚠️ **Random Walk Fundamental** and **Jump / Crash** may have no counterpart in our engine. **OPEN.**

---

## 4. Reconciliation STATE — what's done vs not

### ✅ Done
- **Plan I, single config** (`DLM_DEFAULTS`): per-round mean |P−FV| matched to m0nius within
  MAD < 1.5¢. Claimed reference per-round dev **{R1 3.65, R2 2.49, R3 1.72, R4 2.28}** (50%
  replacement); R4-1/3 ≈ 2.81; pooled Haessel R² ≈ 0.99, amplitude ≈ 0.048.
  ⚠️ **These numbers are PENDING re-verification this session** (see §6 / S921 below).
- DLM directional conclusions (Points 1–4) pass for Plan I across `treatment` and `assetClass`.

### ❌ NOT done (the real gaps — flagged 2026-06-06)
1. **Config sweep vs m0nius** — numeric match validated at exactly ONE config. No sweep of
   α₀/σ₀/ω₀/γα/N/risk-split/asset against m0nius.
2. **Plan II reconciliation** — ZERO. Our Plan II never compared to m0nius Plan II.
3. **Plan III reconciliation** — ZERO.
4. **Runtime export & comparison** — ZERO. No timing instrumentation either side.
   (Only `ms` in our code = UI playback speed + mobile swipe.)

---

## 5. Runtime framing (avoid the misleading metric)

- **Plan I runtime is animation-dominated** (m0nius Speed slider ×N). Wall-clock measures the
  animation, not compute — both engines are effectively instant. **Do NOT report
  "Plan I: m0nius Xs vs ours 0.1s".**
- **Only Plan II/III runtime is meaningful** (LLM-bound). Honest metric =
  **per-call latency × call count, with provider noted**, not a raw wall-clock delta.
  - Ours: DeepSeek, ~1.5s/call (thinking disabled), max_tokens 1024.
  - m0nius provider/model: **OPEN — determine from network trace / Export.**
- Call count per run ≈ nAgents × nPeriods × nRounds (Plan II/III).

---

## 6. Provenance rules (S921 guard — non-negotiable)

S921: earlier "m0nius" R²/amplitude numbers turned out to be **locally fabricated**
(our `computeMetrics()` on m0nius's price export, with a since-fixed denominator bug), NOT
numbers m0nius reports. To never repeat that:

1. **Every m0nius number comes from an actual Export, timestamped.** No locally-computed
   stand-ins presented as "m0nius says".
2. m0nius reports per-round only **mean |P−FV| (¢)** and **turnover**; R²/amplitude are
   **pooled** (whole session), not per-round.
3. m0nius is stochastic → always use the **10-session batch average**, never a single run.
4. **Re-verify the default config FIRST** each session before trusting any sweep number:
   confirm Plan I default still reads {3.65, 2.49, 1.72, 2.28} off m0nius live.

---

## 7. OPEN probes (pending — gate the full build)

- [ ] **Export file schema** — does it contain a timing/compute field, or only price/quality?
- [ ] **Plan II/III runnable in our hands?** — server-side key (free, their dime) vs needs ours.
- [ ] **m0nius LLM provider/model** for Plan II/III (for honest runtime comparison).
- [ ] **N=10 vs "fixed N=100"** internal-scale question.
- [ ] **Prior Bias ON (m0nius default)** vs our structural-bubble bias=0 — reconcile.
- [ ] **Random Walk Fundamental / Jump-Crash** asset classes — do we have counterparts?
- [ ] **Re-verify default {3.65, 2.49, 1.72, 2.28}** live.

---

## 8. Reconciliation plan (gated — confirm grid with user before executing)

1. Orientation probe (§7) — reshapes the grid.
2. Re-verify defaults live (§6.4).
3. Design sweep grid **with user**: configs × {Plan I, II, III} × {per-round dev, pooled
   R²/amplitude, turnover, (II/III) runtime}. Every m0nius cell = real Export, timestamped.
4. **Scope warning**: grid × 3 plans, II/III LLM-bound & stochastic both sides = real tokens
   (m0nius's + ours) + slow (single browser, batch-averaged). Confirm dimensions before
   running 100+ cells; `log()` any silent cap.

---

## 9. Progress — 2026-06-06 session

### Headless harness (the unlock)
m0nius is a client-side app exposing its engine as globals: **`window.App`** (controller/store)
and **`window.AI`** (LLM client). Key facts:
- `App.tunables` = `{expAlpha0, expSigma0, expOmega0, expGammaAlpha, expGammaSigma, betaAnchor/Trend/Dividend/Narrative, biasAmount, applyBias, applyNoise, valuationNoise, …}` — set directly (no slider wrangling). `_syncTunableConfigs()` folds them into the engine on `rebuild()`.
- `App.seed` is real (UI hides it); `reset()` re-rolls per session → 10-session batches are stochastic (average is the reference).
- `App.config.ticksPerFrame` + `tickInterval` = pacing; cranking them (turbo) runs a **Plan I 10-session batch headless in ~4s** via `App.start()` (poll `App._batchRunning`/`_exportSessions.length>=10`).
- Results: `App.batchResults` / `App._buildBatchExport()` → per-(session,round) `{meanDev, turnover, volume, payoff}`. **meanDev = mean over the round's trades of |price − FV(period)|.** This is m0nius's OWN number (closes S921).
- Asset ids: `linearDeclining, constantPerpetual, linearGrowth, cyclicalSine, randomWalk, jumpCrash`.
- A reusable in-page harness was installed at `window.__H` (turbo + apply(cfg) + run(cfg) + grid/runChunk). Ephemeral (lost on reload); re-derive from this doc.

### Resolved OPEN probes (§7)
- **Export schema**: `{meta, sessions, batchSummary}`. `meta.exportedAt` is a stamp only — **NO runtime/compute field**. Per-round = meanDev + turnover only (no per-round R²/amplitude). Runtimes must be MEASURED, not exported.
- **Plan II/III runnable?** YES — m0nius runs the LLM client-side. Gemini key auths through m0nius's proxy (`…rootdirectorylab.com/v1beta`, Google-compatible). One Flash-Lite call = "OK" in ~3.9s.
- **Provider/model**: Gemini, `gemini-3.1-flash-lite-preview` (user-supplied key; key NOT stored here — in-browser only; rotate after use).
- **N=10 vs "fixed N=100"**: `App.TOTAL_N=10`; the N=100 tooltip is a rescale note, not the agent count.
- **Prior bias**: ours `DLM_DEFAULTS.priorBias=true, priorNoise=true` — same as m0nius `applyBias/applyNoise=true`. Engines match at the tuned point via *different* bias/noise mechanisms.
- **random-walk/jump-crash**: exist on BOTH (ours `AssetClass` has them).
- **Re-verify default**: PASSED — m0nius baseline {3.58,2.54,1.72,2.28} ≈ stored {3.65,2.49,1.72,2.28}.

### Plan I — DONE (config sweep, ours vs theirs)
- m0nius 22-config sweep: `m0nius-results/plan-i-m0nius.json`
- ours 22-config sweep (vendored engine, 10 seeds): `m0nius-results/plan-i-ours.json` (runner: `scripts/our-plan-i-grid.test.ts` + `scripts/vitest.grid.config.mts`)
- comparison + two-lever analysis + findings: `m0nius-results/plan-i-comparison.md`
- Headline: match holds at baseline + on N/risk/standard-assets/α₀-near-knee; diverges on σ₀ (inert in ours), ω₀ (muted in ours), random-walk (12¢ vs 1.3¢), high-α₀ bias floor, γα sensitivity. Ours = faithful *reduced* model calibrated at default, not a bit-for-bit reimplementation.

### Plan II/III — runtime reality (BLOCKS full sweep)
- Per-agent LLM call each period → ≈ N×periods×rounds×sessions = **~8,000 calls/config** at ~2–4s ≈ **hours/config**. Full 22×2 sweep infeasible as stated.
- Runtime metric (user's 3rd ask) only needs a few runs: per-call latency × call count (from `App.logger.llmCalls`) + total wall-clock, **same Gemini model both sides**. Plan I runtime is animation/turbo-dominated → not compared.
- **Status: awaiting feasible Plan II/III scope decision.**
