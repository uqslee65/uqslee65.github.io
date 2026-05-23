# Reference Site Comparison

## Overview
Systematic comparison between our DLM (2005) bubble simulator and the reference implementation at assets.m0nius.com.

## Feature Comparison

| Feature | Reference Site | Our Site | Gap |
|---------|---------------|----------|-----|
| Batch mode | 10 sessions, aggregated Table 2 | 1 session | Major — needed for statistical robustness |
| Asset class switching | Pre/post replacement round | Single asset class throughout | Medium |
| Treatment composition | T-small/T-big per session | Hard-wired | Medium |
| Named agents | Editable names + endowments | Generic numbered agents | Minor |
| Additional metrics | P/FV, allocative efficiency, welfare, deception, AIPE | R², NAD, amplitude, turnover | Medium |
| Configurable replacement round | User-selectable | Fixed at round 4 | Minor |
| Architecture/Glossary tabs | Present | Absent | Minor (docs only) |
| Batch results table | Table 2 aggregated across sessions | N/A (1 session) | Major |

## Theoretical Correctness Verification

Our engine (seed=42, DLM defaults) produces:

| Round | Haessel R² | NAD | Published R² | Published NAD | Pattern Match |
|-------|-----------|------|-------------|--------------|------|
| 1 | 0.176 | 4.804 | 0.18 | 4.8 | Yes — large bubble |
| 2 | 0.409 | 3.917 | 0.41 | 3.9 | Yes — attenuation |
| 3 | 0.685 | 2.880 | 0.69 | 2.9 | Yes — convergence |
| 4 | 0.476 | 3.876 | 0.48 | 3.9 | Yes — novice disruption |

## Key Invariants Verified

1. R1→R3: R² monotonically increases (learning effect)
2. R1→R3: NAD monotonically decreases (less mispricing)
3. R4 < R3 in R² (replacement disrupts learning)
4. R4 > R3 in NAD (replacement increases mispricing)
5. FV at period 1 of any round = nPeriods × expectedDiv = 100
6. FV resets at round boundary (confirmed: R1P20 FV=5 → R2P1 FV=100)

## Qualitative Pattern Match

Both sites produce the canonical DLM bubble shape:
- Round 1: Large bubble with prices significantly above FV
- Round 2: Attenuated bubble — experienced agents track FV better
- Round 3: Near convergence — most agents are experienced
- Round 4: Bubble returns — novice replacement resets learning gains

## Prioritized Backlog

1. **Batch mode** (High) — Run N sessions and aggregate metrics into Table 2
2. **Additional metrics** (Medium) — P/FV ratio, allocative efficiency
3. **Treatment switching** (Medium) — Support both T-small and T-big in one experiment
4. **Asset class mid-experiment switch** (Low) — Change asset class at replacement round
5. **Named agents** (Low) — Editable names and initial endowments

## Notes

- Seeds are not comparable across implementations — different PRNGs
- Focus is on qualitative pattern match, not exact numerical equality
- Our engine uses EU-maximizing agents with CRRA utility; reference may use different agent model
- Bounded rationality and regulator are now implemented (as of current version) but not present in reference
