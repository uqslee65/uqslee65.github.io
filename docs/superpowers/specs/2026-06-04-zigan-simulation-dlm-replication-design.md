# Design — `zigan-simulation` extraction + DLM (2005) 1-to-1 replication fix

Date: 2026-06-04
Status: approved-design (pending written-spec review)

## 0. Context

The website `phd-finance-student` embeds a browser-based agent simulator of
Dufwenberg, Lindqvist & Moore (2005), "Bubbles and Experience: An Experiment"
(AER 95(5), 1731–1737), on two pages: `/simulator` and `/app`. The simulator
code lives in `src/lib/sim/` (engine, metrics, assets, types, llm-*) and
`src/components/simulator/`, with a results helper server in `server/`.

The original creator of the reference site **https://assets.m0nius.com/**
reviewed this repo's simulator and raised two problems:

1. **None of the paper's / reference's four conclusions are reproduced:**
   - P1. Positive mispricing (bubble) that **decreases as players gain experience**.
   - P2. A **minority of experienced + majority of inexperienced** players do **not**
     generate large bubbles.
   - P3. (m0nius extension) Mispricing/bubble **depends on the asset type**.
   - P4. (m0nius extension) **Experience does not transfer across assets.**
2. **The repo lets the user trade a *portfolio of assets simultaneously*** — which
   is not DLM and not what m0nius does.

Two tasks follow: (A) fix the replication to be 1-to-1 with m0nius functionality,
then (B) gracefully extract the simulator into a sibling package `../zigan-simulation`
without breaking the website or the simulator.

## 1. Findings from investigation (evidence base)

### 1.1 The paper (read in full, 7 pp.)
- Asset life = **10 periods**; per-period dividend ∈ {0, 20}¢, equal prob; E[d]=10¢;
  FV with k periods remaining = k×10 (100¢ → 10¢).
- **6 subjects** per market; half endowed (200¢, 6 assets), half (600¢, 2 assets);
  **24 shares** outstanding.
- A session = **4 consecutive markets (rounds)**. Rounds 1–3 keep the same 6 subjects
  (they gain experience). **Round 4**: 2 or 4 experienced subjects replaced by
  inexperienced — two treatments: **R4-⅔** (4 exp + 2 inexp) and **R4-⅓** (2 exp + 4 inexp).
  Ten sessions, five of each.
- Result: deviation from FV **decreases across rounds 1→3**; **no bubble resurfaces in
  round 4**; round 3 ≈ round 4; **R4-⅔ ≈ R4-⅓** (cannot reject). Four measures:
  Haessel-R², normalized absolute price deviation, normalized average price deviation,
  price amplitude. DLM Table 2 amplitude by round: 0.81 / 0.80 / 0.59 / 0.55.
- **Conclusion:** "bubbles in mixed-experience markets are rare."
- Points P3 and P4 are **not** in the paper — they are m0nius's own extensions.

### 1.2 The reference site (m0nius), via Playwright
- **Scaled parameterisation** (documented on-site, deliberate): N=10 default, T=**20**
  periods, dividends **{0,10}¢** (E=5), FV₁=100→FV₂₀=5; endowments cash ≈ U[800,1200],
  shares ∈ {2,3,4}. **The repo's `DLM_DEFAULTS` already matches all of these.**
  → Do **not** change period count / dividends / endowments toward paper-literal; that
  would diverge from m0nius and break "Plan I results the same."
- **One asset per session.** Asset is chosen per session with a **pre-asset → post-asset**
  selector that swaps at the **replacement round** (r=4); a Pearson **|corr|** between the
  pre/post FV paths is displayed and drives experience blending. There is **no simultaneous
  basket.**
- Experience anchors (Advanced panel defaults): **α₀=1.0, σ₀=5.0, ω₀=0.60, γα=0.15, γσ=0.30**.
- Heuristic β weights (0.50, 0.20, 0.20, 0.10) and Prior Bias / Prior Noise toggles match repo.
- Three plans: Plan I (algorithmic, deterministic given PRNG), Plan II (LLM + CRRA utility
  in prompt), Plan III (LLM + risk label only).
- **No seed input.** Re-navigating the page yields entirely different agents
  (names/ρ/cash/shares re-sampled). m0nius is **stochastic by default** → exact numeric
  parity is impossible; only pattern + averaged-magnitude parity is achievable.
- A single live Plan I session produced per-round mean-abs-deviation 3.4 / 2.7 / 1.7 / 2.2¢,
  Haessel R²=0.993, amplitude 0.039, ~1519 trades/round. (One unseeded run — indicative, not
  a calibration target; the **10-session Export batch** is the target.)

### 1.3 The repo engine, via a local deterministic probe (Plan I, seed 42)
| experience params | R² R1→R4 | amplitude R1→R4 | MAD R1→R4 | trades/round |
|---|---|---|---|---|
| repo default α₀=0.4, σ₀=15 | 0.18 / 0.41 / 0.69 / 0.48 | 0.43 / 0.33 / 0.24 / 0.29 | 24 / 20 / 14 / 19 | ~365 |
| m0nius cal α₀=1.0, σ₀=5 | 0.87 / 0.89 / 0.90 / 0.88 | 0.154 / 0.131 / 0.116 / 0.104 | 9.5 / 8.8 / 8.1 / 9.4 | ~360 |

- Aligning α₀/σ₀ is **necessary**: it turns a noisy non-monotone path (R1 R²=0.18) into a
  tight, monotonically-improving one (amplitude decreasing R1→R4, R4≈R3) — i.e. P1 + the R4
  result appear.
- It is **not sufficient**: residual ~3× tightness gap (m0nius MAD≈3, R²≈0.99) and a ~4×
  trade-volume gap remain. These are microstructure differences, not a single param.

## 2. Decisions (locked with user)
1. **Match bar:** qualitative pattern + magnitudes within m0nius's **10-session batch band**.
   Not bit-exact (impossible — no seed). My engine stays seeded for my own regression tests.
2. **Calibration depth:** align α₀/σ₀, confirm the 4 points + the decreasing/R4≈R3 pattern,
   land magnitudes in the batch band. Do **not** overfit to m0nius's exact 0.993/0.039.
3. **Extraction:** `zigan-simulation` as a **shared standalone package**; the website imports
   `BubbleSimulator` from it. `/simulator` and `/app` stay embedded.
4. **Order:** fix + verify replication **in-place first**, then extract.
5. **Deploy gate:** no repush until `vitest` + Playwright `e2e` pass **and** both sites' Plan I
   patterns match.

## 3. Part A — Replication correctness (in-place)

### A1. Remove the simultaneous multi-asset portfolio (structural; the reviewer's core complaint)
- Delete/retire portfolio surface: `SimConfig.assets[]` weighting as a basket, the
  `sharesPerAsset[]` multi-asset trading path (`OrderBook.match(...assetIdx)` for >1 asset,
  `Agent.matchMultiAsset`/multi-asset EU argmax), multi-asset branches in `llm-prompts.ts`,
  `assetHelpers.ts` multi-asset fan-out, multi-asset figure branches, and the
  `ExperimentSetupModal` portfolio configuration UI.
- Replace with **one asset per session**. Keep a single `assetClass` plus an optional
  **`postAssetClass`** that takes effect at the **replacement round** (r=4), mirroring m0nius's
  pre→post selector. Compute and surface **|corr|** between pre/post FV paths.
- Net invariant: within any round, every agent holds inventory in exactly one asset; the only
  asset change happens at the replacement-round boundary.

### A2. Reproduce the four points
- **P1** — cross-round experience curves α_i = min(1, α₀+γα·k), σ_i = σ₀·exp(−γσ·k),
  ω_i = ω₀+δω·min(kMax,k). Already present; calibrate defaults (A3) so the bubble visibly
  decreases R1→R3.
- **P2** — R4 replacement treatments **R4-⅔** (⅔ experienced) and **R4-⅓** (⅓ experienced),
  scaled to N. Verify the engine yields R4-⅔ ≈ R4-⅓ and neither reignites a large bubble.
- **P3** — with one asset per session, the asset-type selector lets the user run LD / CP / LG /
  CY / RW / JC and observe **different** mispricing per type. Surface a per-asset-type comparison.
- **P4** — at r=4, when post-asset ≠ pre-asset, blend experienced agents' (α,σ,ω) **toward the
  novice anchors by (1−|corr|)** so experience does not transfer across uncorrelated assets.
- Surface these in the UI/figures and on the website's `/simulator` explanatory copy (the current
  "about" text claims findings the engine must now actually produce).

### A3. Calibrate Plan I to m0nius
1. **Capture the target first:** drive m0nius via Playwright → Reset → Export (auto-runs 10
   sessions, downloads a zip with `data.json`) → record per-round averaged R²/amplitude/MAD/
   turnover bands. This washes out the no-seed noise. Cross-check shape against DLM Table 2.
2. Set experience defaults **α₀=1.0, σ₀=5.0** (others already match).
3. Investigate the residual price-tightness and the ~4× trade-volume gap (order generation/
   matching microstructure). Tune until per-round metrics land in the batch band and the
   qualitative invariants hold. Stop there (no overfitting).

### A4. Verification (Part A done = all true)
- New/updated `vitest` asserting, on seeded Plan I: amplitude & MAD decreasing R1≥R2≥R3,
  R4 ≈ R3 (within tolerance), R² rising into ~0.9 band, R4-⅔ ≈ R4-⅓, and per-asset-type
  mispricing differs.
- Playwright e2e: single-asset enforced (no portfolio UI), asset swap at r=4 with |corr| blend.
- Manual Playwright cross-check vs m0nius batch bands.

## 4. Part B — Extract to `../zigan-simulation` (after A verified)

### Structure
```
zigan-simulation/                 # standalone, runnable + testable on its own
  package.json   (name: "zigan-simulation", exports BubbleSimulator + sim lib)
  src/lib/sim/...                 # engine, metrics, assets, types, llm-*
  src/components/simulator/...    # all simulator React components + BubbleSimulator
  server/                         # results server
  (tests move with the code: src/lib/sim/__tests__, e2e/)
phd-finance-student/
  package.json   -> deps: "zigan-simulation": "file:../zigan-simulation"
  src/components/BubbleSimulator.tsx -> re-export from the package
  src/pages/simulator.astro, app.astro -> import from the package
  (thin website-side smoke test only)
```

### Approach
- Move `src/lib/sim`, `src/components/simulator`, `server/`, and the simulator tests into the
  package. Provide a clean package entrypoint that exports `BubbleSimulator` (and the sim lib for
  tests). Keep React/KaTeX/Tailwind peer-compatible with the website.
- Website: add the `file:` dependency, replace the local `BubbleSimulator` with a re-export, keep
  `/simulator` and `/app` importing it. Verify `astro build` succeeds and both pages render.
- Move Playwright e2e into the package; leave a minimal website smoke test that the pages mount.

### Verification
- Package: `npm install && npm test && npm run build` (or its dev server) green in isolation.
- Website: `npm install` (resolves `file:../zigan-simulation`), `npm run build`, `vitest`, e2e all
  green; `/simulator` and `/app` render and run a Plan I session.

## 5. Order of work & deploy gate
1. A1 (remove portfolio) → A2 (points) → A3 (calibration) → A4 (verify) — all in-place.
2. B (extract to package) → re-run all package + website tests and builds.
3. **Repush only when:** `vitest` + e2e pass in both places, website builds, and Plan I patterns
   match on both sites (qualitative + batch band).

## 6. Out of scope / YAGNI
- Paper-literal parameterisation (6 agents / 10 periods / {0,20}¢ / (200,6)+(600,2)) — rejected;
  it diverges from m0nius and breaks the match bar.
- Bit-exact numeric parity with m0nius — impossible (no seed).
- LLM (Plan II/III) calibration — unchanged except where the portfolio removal touches prompts;
  no behavioural retuning.
- Any unrelated website refactor.
