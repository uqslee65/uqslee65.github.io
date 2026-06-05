# Plan II/III — attempt notes, blocker, and runtime data (2026-06-06)

Plan II/III run m0nius's LLM agents (Gemini Flash-Lite Preview, via m0nius's proxy
`…rootdirectorylab.com/v1beta`, user-supplied key). Driven headless through `window.App`
(plan II, single session, `_runBatchSession(0)`), same harness as Plan I.

## Runtime (the "export their runtimes" ask)

- **m0nius's export contains NO runtime/compute field** (only `meta.exportedAt` stamp).
  Runtime must be MEASURED, not exported.
- **Per-call latency**: ~3.9s isolated (one Flash-Lite call, gate test).
- **Throughput**: ~10 agents fire concurrently each period boundary → **~224ms/call
  wall-clock amortized** (~4.5 calls/s observed).
- **Call volume**: N×periods×rounds = 10×20×4 = **800 calls/session**; a full 10-session
  batch = **~8,000 calls/config** (~30 min/config wall-clock; large token spend).
- → A full 22-config × {II,III} sweep is infeasible (hours-to-days, ~350k calls). Plan I
  runtime is NOT comparable (turbo/animation-dominated).

## BLOCKER: degenerate market under Flash-Lite

Two headless Plan II runs (periods=6 and periods=20), linear-declining asset, risk 33/34/33,
temperature 0.4: agents return **~99% `ASK` (sell)** — e.g. 148/150 ASK, 1 BID, 1 HOLD.
With almost no bids, the order book never crosses → **~0 trades → meanDev undefined**.

Sample agent reasoning: *"The fundamental value of this declining asset is 30 … expected
dividend 5/period …"* → uniformly concludes SELL. Gemini Flash-Lite appears to converge on a
single rational "sell the declining asset" stance, collapsing the two-sided market.

This is a **fidelity question**, not obviously a bug:
- If m0nius's own published Plan II uses a stronger/different model (or higher temperature,
  or a prompt that injects heterogeneity), Flash-Lite may simply be too coordinated-bearish.
- Or m0nius's Plan II genuinely has thin trading on declining assets.

**Tuning does NOT fix it (3rd attempt):** risk-loving-heavy mix (70/15/15) + temperature 0.9
still produced 70/70 ASK in the first ~16s (early-aborted to save quota). So the degeneracy is
robust to the behavioral-diversity levers — it is intrinsic to Flash-Lite's reasoning on the
declining DLM asset, not a temperature/risk artifact. Strongly implies the reference Plan II
(if it exists) used a different/stronger model, OR Plan II per-round numbers were never part of
the m0nius reference at all (the validated reference was Plan I only).

## Options (need a decision — each costs Gemini quota)

1. **Tune for trading** (raise temperature → behavioral diversity; or risk-loving-heavy mix →
   natural bidders) and re-test ~1 session. Cost ~800 calls/attempt.
2. **Try a stronger model** (gemini-3-flash-preview / 3.1-pro) for 1 session to see if a
   functioning market emerges — contradicts the "Flash-Lite for cost" instruction, so only on
   explicit OK. Cost ~800 calls.
3. **Verify m0nius's own Plan II** via its normal UI first (does THEIR default Plan II trade?)
   before more headless runs.
4. **Accept Plan I as the deliverable** + document this Plan II degeneracy as a finding
   (LLM-agent coordination kills the market) and stop spending quota.

## State
- ~650 Gemini calls spent across two diagnostic runs (0 valid meanDev rows).
- Plan I reconciliation is COMPLETE and committed (see plan-i-*.{json,md}).
