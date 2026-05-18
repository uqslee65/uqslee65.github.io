# Simulator Redesign — Hybrid Sidebar + Scrollable Canvas

**Date:** 2026-05-18
**Scope:** `/simulator` page only (BubbleSimulator React app)
**Approach:** C — Sticky sidebar with controls/context, scrollable canvas with figure groups

## Problem

The current simulator layout has critical UX bugs:
1. **Period buttons not clickable** — `scrollSnapType: 'x mandatory'` in RoundStrip consumes click events
2. **Expand All broken** — 7 cards × 600px = 4200px overflow with no scrollable container on RightColumn
3. **Right column scroll broken** — No `overflow-y` on parent grid cell; expanded cards clip silently
4. **Potential crash** — All 7 SVG figures expanding simultaneously stalls rendering

The layout also overloads users: 12 scattered figures, 7 bottom tabs, collapsible cards all visible at once.

## Design

### Layout: 2-Column Flex

```
┌─────────────────────────────────────────────────────────┐
│  ControlBar (existing — plan selector + playback)       │
├──────────────┬──────────────────────────────────────────┤
│  Sidebar     │  Canvas                                  │
│  280px       │  flex: 1                                 │
│  sticky      │  overflow-y: auto                        │
│  top: 0      │                                          │
│  height:100vh│  PriceChart (hero)                       │
│  overflow-y: │  RoundStrip (bug-fixed)                  │
│  auto        │  FigureGroups [Market|Agents|Social]     │
│              │  Table1 (full-width)                     │
│  Context:    │  Table2 (collapsible)                    │
│  - Metrics   │  ReplayTrace (collapsible)               │
│  - Agents    │                                          │
│  - Book (▶)  │                                          │
│  - Feed (▶)  │                                          │
│  - Replay(▶) │                                          │
│              │                                          │
│  Config:     │                                          │
│  - Trade (▼) │                                          │
│  - Risk (▼)  │                                          │
│  - AI (▶)    │                                          │
│  - Adv (▶)   │                                          │
│  - Const (▶) │                                          │
├──────────────┴──────────────────────────────────────────┤
│  Status bar: Plan · Agents · Asset · Seed · Position    │
└─────────────────────────────────────────────────────────┘
```

### Figure Groups (Rule of 3)

12 figures organized into 3 tab-groups displayed as a grid in the canvas:

| Tab | Figures | Plan availability |
|-----|---------|-------------------|
| **Market** (default) | Fig 2 Signed Mispricing, Fig 3 Trade Volume, Fig 4 Density Heatmap, Fig 8 Asset Ownership | All plans |
| **Agents** | Fig 5 Action Timeline, Fig 7 Normalized Utility, Fig 11 Per-Agent P&L, Fig 6 Subj Valuation*, Fig 12 Per-Agent Subj V* | *Plan I only |
| **Social** | Fig 9 Broadcast Messages*, Fig 10 Trust Matrix*, Prompts panel**, Notes panel | *Plan I only, **Plan II/III only |

Plan-conditional figures are hidden (not rendered) when their plan is inactive. The Social tab adapts content based on active plan.

### Mobile (< 768px)

Sidebar becomes a draggable bottom sheet with 3 snap points:
- **Peek** (64px): tab labels visible, drag handle
- **Half** (50vh): one panel scrollable
- **Full** (90vh): all panels scrollable

Canvas stacks vertically. Figure groups use 2-column grid instead of 3.

### Sidebar Architecture

Two logical zones within the sidebar, both scrollable:

**Context zone (top)** — live data that updates during simulation:
- MetricsPanel (compact, always visible)
- AgentsPanel (scrollable grid within)
- OrderBookPanel (collapsible, closed by default)
- TradeFeed (collapsible, closed by default)
- ReplayPanel (collapsible, closed by default)

**Config zone (bottom)** — user-adjustable parameters:
- TradeSettings (open by default)
- RiskPreferences (open by default)
- AIEndpoint (shown only for Plan II/III, open by default when visible)
- AdvancedSettings (closed by default)
- PaperConstants (closed by default)

## Bug Fixes

| Bug | Fix | Location |
|-----|-----|----------|
| Period buttons not clickable | Remove `scrollSnapType: 'x mandatory'` and `WebkitOverflowScrolling: 'touch'`. Keep `overflow-x: auto` only. | RoundStrip.tsx L118 |
| Expand All broken | Delete RightColumn entirely. Figures rendered in FigureGroups grid — no collapse/expand mechanism needed. | RightColumn.tsx (delete) |
| Right column scroll | Eliminated by layout change. Canvas uses natural document scroll. Sidebar has `overflow-y: auto`. | SimulatorLayout.tsx |
| Potential crash | Figures render in groups of 3-4, not 7 simultaneously. Off-screen figures in inactive tabs don't render. | FigureGroups.tsx |

## Component Changes

### Deleted (2)
- `RightColumn.tsx` — replaced by FigureGroups tab grid
- `BottomTabs.tsx` — contents split into Sidebar + Canvas

### Rewritten (3)
- `SimulatorLayout.tsx` — 3-row grid → 2-column flex (Sidebar + Canvas)
- `FigureSwapArea.tsx` → `FigureGroups.tsx` — 5-tab carousel → 3-tab grid housing all 12 figures
- `ConfigurationPanel.tsx` → `ConfigSidebar.tsx` — same `<details>` sections, styled for 280px sidebar

### New (3)
- `Sidebar.tsx` — sticky container, two zones (context + config), overflow-y scroll
- `Canvas.tsx` — flex:1 scrollable main area, renders hero chart + strip + figure groups + tables + replay
- `MobileBottomSheet.tsx` — draggable sheet for mobile, 3 snap points, renders sidebar content

### Kept as-is (19+)
- `BubbleSimulator.tsx` — entry point, no changes
- `SimulatorProvider.tsx` — all state/logic unchanged
- `ControlBar.tsx` — top bar, no changes
- `PlanSelector.tsx` — plan toggle, no changes
- `PriceChart.tsx` — hero chart, no changes
- `MetricsPanel.tsx` — moved to sidebar, minor style adaptation
- `RoundStrip.tsx` — bug fix only (remove scrollSnapType)
- `AgentsPanel.tsx` — moved to sidebar, no logic changes
- `OrderBookPanel.tsx` — moved to sidebar, no logic changes
- `ReplayPanel.tsx` + `TraceInspector.tsx` — moved, no logic changes
- `ExperimentSetupModal.tsx` + `HelpModal.tsx` — no changes
- All 11 `figures/*.tsx` — no changes, only parent container changes
- All 8 `config/*.tsx` — no changes, wrapped by ConfigSidebar

### Data flow
Zero changes to SimulatorProvider, simulation engines (engine.ts, llm-engine.ts), metrics, assets, or types. Only the rendering tree changes.

## Component Tree (New)

```
BubbleSimulator
└── SimulatorProvider
    ├── ControlBar
    │   ├── PlanSelector
    │   ├── ExperimentSetupModal
    │   └── HelpModal
    └── SimulatorLayout
        ├── Sidebar (sticky, 280px)
        │   ├── MetricsPanel (compact)
        │   ├── AgentsPanel
        │   ├── OrderBookPanel (collapsible)
        │   ├── TradeFeed (collapsible)
        │   ├── ReplayPanel (collapsible)
        │   └── ConfigSidebar
        │       ├── TradeSettings
        │       ├── RiskPreferences
        │       ├── AIEndpoint (plan-conditional)
        │       ├── AdvancedSettings
        │       └── PaperConstants
        ├── Canvas (scrollable)
        │   ├── PriceChart (hero)
        │   ├── RoundStrip (bug-fixed)
        │   ├── FigureGroups
        │   │   ├── Tab: Market → Fig2, Fig3, Fig4, Fig8
        │   │   ├── Tab: Agents → Fig5, Fig6*, Fig7, Fig11, Fig12*
        │   │   └── Tab: Social → Fig9*, Fig10*, Prompts**, Notes
        │   ├── Table1 (full-width market stats)
        │   ├── Table2 (batch results, collapsible)
        │   └── ReplayTrace (collapsible)
        └── MobileBottomSheet (< 768px only, replaces Sidebar)
```

## Verification

1. **Build check**: `npm run build` — clean, no regressions
2. **Desktop test** (≥1024px):
   - Sidebar sticky, scrollable independently
   - Canvas scrolls, figure group tabs switch correctly
   - All 12 figures render in their groups
   - Period strip buttons are clickable (scrollSnapType removed)
   - Plan switching shows/hides plan-conditional figures
   - Run simulation → all charts update, metrics populate
3. **Mobile test** (< 768px):
   - Bottom sheet appears instead of sidebar
   - 3 snap points work (peek/half/full)
   - Figure groups use 2-col grid
   - All controls accessible via bottom sheet
4. **Bug regression**:
   - RoundStrip: click any period button → seek() fires, playback jumps
   - No "Expand All" button exists — eliminated by design
   - Scroll: sidebar and canvas scroll independently, no trapped containers
   - Performance: switch figure tabs — no stall or crash
5. **Plan-conditional**:
   - Plan I: all figures visible, AI Endpoint hidden in config
   - Plan II/III: Plan-I-only figures hidden, AI Endpoint visible, Prompts tab in Social
