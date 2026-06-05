# Design — Guided Walkthrough Mode (target-vs-replication proof)

Date: 2026-06-05
Status: approved-design (pending written-spec review)

## 0. Motivation

The simulator was criticised as "a replication that isn't faithful." This feature is a
**guided, hands-free walkthrough** that teaches the DLM (2005) design and **proves faithfulness**
by reconciling our replication against the original paper and the m0nius reference, stage by
stage, with equations and intuition — idiot-proof for an academic audience.

## 1. Locked decisions

| Decision | Choice |
|---|---|
| Target sources | **3 columns: DLM paper (Table 2) · m0nius batch · Ours** |
| Stage navigation | **Prev / Next arrows**; revisiting a stage re-shows its cached output (no re-run) |
| Plans | **All 3.** Plan I deterministic; Plan II/III run **live via DeepSeek** (`deepseek-v4-flash`) |
| LLM run size | **Near-full** (10 agents × 4 rounds × 20 periods) in the UI; e2e uses a bounded override |
| Placement | Inside **`zigan-simulation` package** → appears on both Heroku `/app` and Pages `/simulator` |
| Launch | **Opt-in** "Guided walkthrough" button in the simulator header |
| Gating | Plan II/III stages **hard-block Next** until a non-empty key passes a live test call |

### Security
The DeepSeek key the user shared is used **only** as a local env var (`DEEPSEEK_API_KEY`) for the
e2e run. It is **never** committed, hardcoded, or logged. The key is exposed in chat history →
**rotate it** after acceptance. In-app, Plan II/III read the key from the existing config field
(user-entered), exactly as the normal sim does.

## 2. Faithfulness reconciliation (honest comparison)

The three sources do not share one deviation normalization (DLM normalizes Σ|P−FV| by the 24
shares outstanding; m0nius reports a per-tick mean |price−FV|). So the **rigorous numeric 3-way
columns use normalization-robust measures**:

- **Haessel R²** — `1 − Σ(P̄−FV)² / Σ(FV−FV̄)²`, identical definition everywhere.
- **Price amplitude** — `(max−min)(P̄−FV) / FV₁`, identical definition everywhere.

The **deviations** are shown per-source (each in its own units) to illustrate the **pattern**, and
the panel states the qualitative faithfulness claims explicitly:

1. Mispricing **decreases** R1 → R3 (all three sources).
2. **R4 ≈ R3**, and **R1 ≫ R4** (DLM significance: R1=R4 rejected at p≈0.003–0.03; R3=R4 not rejected).
3. **R4-⅔ ≈ R4-⅓** (DLM cannot reject; p≈0.42–1.0).

### Embedded reference data (`referenceData.ts`)

DLM (2005) **Table 2** — average measures by round:

| Round | Haessel R² | Norm abs price dev | Norm avg price dev | Amplitude |
|---|---|---|---|---|
| 1 | 0.37 | 1.67 | 0.12 | 0.81 |
| 2 | 0.47 | 1.61 | 0.14 | 0.80 |
| 3 | 0.64 | 0.81 | 0.09 | 0.59 |
| 4 | 0.65 | 1.06 | 0.08 | 0.55 |

DLM significance: `p(R1=R4)` = 0.004***, 0.032**, 0.011**, 0.003***; `p(R3=R4)` = 0.618, 0.061*,
0.897, 0.819; `p(R4-⅔=R4-⅓)` not rejected.

**m0nius batch** (captured via Playwright export, 50% replacement): per-round mean |price−FV| =
3.65 / 2.49 / 1.72 / 2.28; Haessel R² ≈ 0.99; amplitude ≈ 0.04. (67% replacement R4 ≈ 2.81.)

**Ours** — computed live by the walkthrough from a seeded Plan I run via `metrics.ts`.

## 3. Architecture (`zigan-simulation/src/components/walkthrough/`)

- **`WalkthroughProvider` / `useWalkthrough`** — state: `stageIndex`, `cachedOutputs[stageId]`
  (run results so revisits don't re-run), `inputs` (api key + provider/model), `gates[stageId]`
  pass/fail. Holds a ref to the `SimulatorProvider` API (setConfig, run, current periods) to
  drive the sim hands-free.
- **`stages.tsx`** — declarative `Stage[]`: `{ id, title, body (JSX with KaTeX), spotlightSelector?,
  action?(sim), gate?, panel? }`. `action` sets config and/or runs; `gate` returns
  `{ ok, reason }`; `panel` selects what comparison/chart to render.
- **`WalkthroughOverlay`** — fixed card: title, body text + equations, **Prev/Next arrows**
  (Next disabled when the current `gate` fails, with the reason shown), progress dots, "Exit".
- **`Spotlight`** — dims the page with an SVG mask cutout + an animated **glow ring** around the
  `spotlightSelector` element (the Run button, a config control). Pointer-events pass through to
  the highlighted element only.
- **`ComparisonPanel`** — the 3-column **Paper | m0nius | Ours** table (R² + amplitude per round)
  + the qualitative claim checklist (auto-ticked when our run satisfies them) + the live chart.
- **`LaunchButton`** — "Guided walkthrough" button added to the simulator header (ControlBar).

Integration: `BubbleSimulator` mounts `<WalkthroughProvider>` + `<LaunchButton>`; when active,
`<WalkthroughOverlay>` renders over the existing UI and drives `SimulatorProvider`.

## 4. Stages (minimal per screen; paper-grounded; equations; "why")

1. **Intro** — Smith-Suchanek-Williams bubbles → DLM's experience question. No action.
2. **Asset & fundamental value** — `FV_t = E[d]·(T−t+1)`; dividend {0,20}¢ (paper) → {0,10}¢
   scaled; backward-induction intuition (why FV is a declining staircase 100→5). Spotlight FV path.
3. **Agents & beliefs** — `V^post_i = ω_i V^prior_i + (1−ω_i) m̄_t`; `V^prior` with
   `α_i=min(1, α₀+γ_α k)`, `σ_i=σ₀e^{−γ_σ k}`, `ω_i=ω₀+δ_ω min(k_max,k)`; heuristic
   `H=Σβ_j·{anchor,trend,div,narrative}`; EU argmax over {hold, buy@A, sell@B, bid, ask}.
   Intuition: experience ⇒ anchor to fundamentals + defer less to the crowd ⇒ bubble shrinks.
4. **Four rounds & replacement** — rounds 1–3 same group (gain experience); R4 replaces ⅓ (R4-⅔)
   or ⅔ (R4-⅓). Why: isolate the effect of *mixed* experience.
5. **Measures** — Haessel R², normalized abs/avg price deviation, amplitude (equations + meaning).
6. **Plan I run** — set Plan I (seeded), **glow Run**, run hands-free → price chart.
7. **Plan I proof** — `ComparisonPanel`: Paper|m0nius|Ours; claims auto-checked (decreasing R1→R3,
   R4≈R3, R1≫R4). The faithfulness payoff.
8. **Plan I variant** — flip R4-⅔→R4-⅓ (glow the treatment control), re-run, observe point 2
   (minority-experienced still no large bubble).
9. **Plan II (LLM + utility)** — **GATE**: requires DeepSeek key (provider=deepseek,
   model=deepseek-v4-flash). Explains the prompt embeds CRRA `U(w;ρ)=w^{1−ρ}/(1−ρ)`. Runs live
   (near-full) with the LLM progress bar; shows chart + how LLM pricing compares.
10. **Plan III (LLM + risk label)** — gated (key carried over). Prompt names only the risk label,
    no utility form. Runs live; contrast with Plan II.
11. **Cross-plan comparison** — Plan I vs II vs III vs the human target: which best matches DLM.
12. **Four conclusions** — recap (the 4 points) with the proof links.

## 5. Gating logic ("cannot pass as the original")

- Plan II/III stages have `gate = async () => testConnection(key) → { ok }`. Empty / whitespace /
  obviously-malformed keys fail immediately; a real key must pass a live test call. Next stays
  disabled (greyed, with reason) until the gate passes for that stage.
- A stage whose `action` is "observe a run" only allows Next once a run has actually produced
  periods (no skipping past an unran stage).

## 6. Testing (Playwright, end-to-end)

- **`e2e/walkthrough.spec.ts`** (website, drives the deployed-style build):
  - Start tour from the button; step Prev/Next through stages 1–8.
  - Stage 7: assert `ComparisonPanel` renders the Paper/m0nius/Ours columns and the three
    qualitative claims are ticked (our seeded Plan I satisfies decreasing R1→R3, R4≈R3).
  - Stage 8: assert flipping the treatment changes R4 as expected.
  - **Gate test (the key requirement):** at Stage 9 with **no key**, assert **Next is disabled**
    and the tour cannot advance. Then set the DeepSeek key from `process.env.DEEPSEEK_API_KEY`,
    assert the gate passes, a live run completes, and Next enables. (Test uses a bounded config
    override — ~4 agents × 1 round × 2 periods — so the automated run is fast/cheap while still
    a real DeepSeek call. `test.skip` when `DEEPSEEK_API_KEY` is unset.)
- Package unit test: `referenceData` shape + the claim-evaluation pure function
  (given per-round metrics → which faithfulness claims hold).

## 7. Deploy

Re-pack the `zigan-simulation` tarball → `vendor/`, rebuild the website, **re-sync `dist` →
`myself-app/public` and push Heroku**, and **push `origin main`** (Pages). Gated on: package +
website unit tests, the walkthrough e2e (incl. the live DeepSeek gate test), and a live smoke.

## 8. Out of scope / YAGNI

- No third-party tour library (custom overlay; ~one small component each).
- No persistence of walkthrough progress across reloads (opt-in each session).
- No new LLM providers; DeepSeek only for II/III (others already disabled).
- No change to the engine or the 4-point replication (already shipped).
