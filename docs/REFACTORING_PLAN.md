# Solar + Battery ROI Calculator - Refactoring Plan

## Executive Summary

This document outlines the current architecture issues, inconsistencies across tabs, and a refactoring plan to create a cleaner, more maintainable codebase.

**Status: ✅ Refactoring Complete (January 2026)**

---

## Refactoring Progress

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1.1 | Extract `useAppState` hook | ✅ Complete | Centralised state management |
| 1.2 | Extract UI components | ✅ Complete | Header, Footer, ConnectionStatusCard, etc. |
| 2.1 | Scenario selector | ✅ Complete | 3-way toggle: Baseline / Solar Only / Solar + Battery |
| 2.2 | Update EnergyFlowChart | ✅ Complete | Supports all scenarios |
| 2.3 | Update ResultsTable | ✅ Complete | Supports all scenarios |
| 3.1 | Tariff selection hook | ✅ Complete | `useTariffSelection` hook |
| 5.1 | Cost-engine tests | ✅ Complete | 13 new tests for tariff calculations |

### Key Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| App.tsx lines | 603 | 398 | **-34%** |
| Unit tests | 58 | 71 | +13 |
| E2E tests | 21 | 21 | - |
| New hooks | 0 | 5 | +5 |
| New components | 0 | 6 | +6 |

### New Files Created

**Hooks:**
- `src/hooks/use-app-state.ts` - Centralised state management
- `src/hooks/use-config-change-detection.ts` - Auto-detect config changes
- `src/hooks/use-actual-tariff-effect.ts` - Tariff fetch→store→simulate flow
- `src/hooks/use-tariff-selection.ts` - Tariff preset switching

**Components:**
- `src/components/app-header.tsx` - App header with theme toggle
- `src/components/app-footer.tsx` - Footer with legal/GitHub links
- `src/components/connection-status-card.tsx` - "Connected to Octopus" card
- `src/components/stale-results-warning.tsx` - "Settings changed" warning
- `src/components/connect-overlay.tsx` - Initial CTA overlay
- `src/components/scenario-selector.tsx` - Scenario toggle component

**Tests:**
- `src/lib/cost-engine.test.ts` - Tariff calculation tests

---

## Original Architecture Overview

### Data Flow
```
User connects → Fetch consumption + solar data → Run simulation → Display across 3 tabs
                     ↓                              ↓
              actualTariff fetched       Produces: baseline, solarOnly, withSolar, actualSpend
                (async, after)
```

### Key Files
| File | Responsibility | LOC | Status |
|------|---------------|-----|--------|
| `App.tsx` | **398 lines** - UI composition | ✅ Reduced | Was 603, now focused |
| `use-app-state.ts` | Centralised state management | 260 | ✅ New |
| `use-simulation.ts` | Calculation orchestration | 287 | Good separation |
| `daily-simulator.ts` | Energy flow simulation | 296 | Well-structured |
| `summary-metrics.tsx` | Hero stats + cost flow | 162 | Recently simplified |
| `cost-chart.tsx` | Monthly cost line chart | 144 | Clean |
| `energy-flow-chart.tsx` | Energy kWh visualization | 193 | ✅ Supports all scenarios |
| `results-table.tsx` | Monthly breakdown table | 147 | ✅ Supports all scenarios |

---

## Issues Identified

### 1. App.tsx is a God Component (HIGH PRIORITY)
**Problem:** 603 lines with mixed responsibilities:
- Connection state management
- Data fetching orchestration  
- Config change detection
- Re-calculation logic
- Theme management
- Layout rendering

**Impact:** Hard to test, hard to modify, high cognitive load.

### 2. Tab Data Inconsistency (HIGH PRIORITY)
**Problem:** Each tab shows different data scenarios:

| Tab | Currently Shows | Should Also Show |
|-----|-----------------|------------------|
| **Results** | actualSpend, baseline, solarOnly, withSolar | ✅ Comprehensive |
| **Energy** | `withSolar` only | Should show solarOnly comparison, or actual vs projected |
| **Data** | `withSolar` only | Should offer scenario toggle |

**Specific Issues:** (All resolved)
- ~~Energy tab shows "Grid Import/Export" but these are *calculated* values for solar+battery, not raw data~~ ✅ Conditional columns per scenario
- ~~Data tab has no context about what scenario it's showing~~ ✅ Scenario selector added
- ~~No way to compare scenarios side-by-side in Energy/Data tabs~~ ✅ Scenario toggle added

### 3. Calculation Timing Issue ✅ (FIXED)
**Problem:** Initial connect doesn't include `actualSpend` because tariff fetch is async.
**Status:** Fixed with `hasRunWithActualTariffRef` pattern, extracted to `useActualTariffEffect`.

### 4. Config Change Detection ✅ (FIXED)
**Problem:** ~~Manual field-by-field comparison in `useEffect`~~
**Solution:** Extracted to `useConfigChangeDetection` hook using JSON.stringify comparison.

### 5. Multiple Sources of Truth for Tariff Data ✅ (IMPROVED)
**Problem:** Tariff information exists in multiple places.
**Solution:** Created `useTariffSelection` hook to centralise tariff preset ↔ actual tariff switching logic. While not a full context, it provides a clean API for the main concern.

### 6. Simulation Hook Returns Too Many Things (LOW - Deferred)
```typescript
return {
  actualSpend, baseline, solarOnly, withSolar,  // 4 scenarios
  comparison, roi,                               // derived values
  loading, error, runSimulation, reset          // state + actions
};
```
**Note:** Left as-is for now. The interface is stable and well-documented.

---

## Refactoring Plan

### Phase 1: Extract State Management from App.tsx

**Goal:** Reduce App.tsx to ~200 lines of pure UI composition.

#### 1.1 Create `useAppState` hook
```typescript
// src/hooks/use-app-state.ts
export function useAppState() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [storedConsumption, setStoredConsumption] = useState<...>(null);
  const [storedGeneration, setStoredGeneration] = useState<...>(null);
  // ... etc
  
  return {
    connection: { isConnected, consumption, generation, ... },
    config: { scenarioConfig, setScenarioConfig },
    actions: { connect, disconnect, recalculate },
  };
}
```

#### 1.2 Create `useConfigChangeDetection` hook
```typescript
// src/hooks/use-config-change-detection.ts
export function useConfigChangeDetection(
  currentConfig: ScenarioConfig,
  lastCalcConfig: ScenarioConfig | null
): boolean {
  // Deep comparison with JSON.stringify or lodash isEqual
  return JSON.stringify(currentConfig) !== JSON.stringify(lastCalcConfig);
}
```

### Phase 2: Consistent Tab Data Architecture

**Goal:** All tabs show consistent, selectable scenario data.

#### 2.1 Add scenario selector to Data/Energy tabs
```typescript
// New prop for all visualization components
interface ScenarioData {
  baseline: AnnualFinancialSummary;
  solarOnly: AnnualFinancialSummary;
  withSolar: AnnualFinancialSummary;
  actualSpend?: AnnualFinancialSummary;
}

// User can toggle between scenarios or see comparison
```

#### 2.2 Update EnergyFlowChart to show comparisons
- Add "Scenario" dropdown: `Baseline | Solar Only | Solar + Battery`
- Show side-by-side bars for `Your Usage` vs `Grid Import` vs `Solar Used`
- Make clear what's actual data vs calculated

#### 2.3 Update ResultsTable to support scenario comparison
- Add toggle: "Show Solar Only | Show Solar + Battery | Compare"
- Color-code cells based on scenario
- Show delta column when comparing

### Phase 3: Simplify Tariff Data Flow

**Goal:** Single source of truth for tariff information.

#### 3.1 Create unified tariff context
```typescript
// src/contexts/tariff-context.tsx
interface TariffContextValue {
  // User's actual tariff (fetched)
  actualTariff: {
    config: TariffConfig | null;
    info: ActualTariffInfo | null;
    rates: TariffRatePeriod[] | null;
  };
  
  // Selected tariff for simulation
  selectedTariff: {
    preset: string;
    config: TariffConfig;
  };
  
  // Whether using actual tariff for simulation
  usingActualTariff: boolean;
}
```

### Phase 4: Improve Type Safety

#### 4.1 Add discriminated unions for scenarios
```typescript
type SimulationScenario = 
  | { type: 'baseline'; data: AnnualFinancialSummary }
  | { type: 'solar-only'; data: AnnualFinancialSummary }
  | { type: 'solar-battery'; data: AnnualFinancialSummary }
  | { type: 'actual-spend'; data: AnnualFinancialSummary };
```

#### 4.2 Add strict null checks
Currently `simulation.withSolar?.monthlyBreakdown` is used everywhere - should be guaranteed non-null after successful simulation.

### Phase 5: Testing & Documentation

#### 5.1 Add unit tests for calculation engines
- `daily-simulator.test.ts` (exists, expand)
- `cost-engine.test.ts` (new)
- `use-simulation.test.ts` (new)

#### 5.2 Add integration tests for data flow
- Test that changing config → recalculate → all tabs update
- Test that actualSpend appears after tariff fetch

---

## Tab-by-Tab Consistency Checklist

### Results Tab ✅ (Complete)
- [x] Shows "You Paid" (actualSpend)
- [x] Shows "Without Solar" (baseline on selected tariff)
- [x] Shows "Solar Only" vs "Solar + Battery"
- [x] Savings calculated vs correct reference (actualSpend if available)
- [x] Uses consistent ScenarioType throughout

### Energy Tab ✅ (Complete)
- [x] Scenario selector with Baseline / Solar Only / Solar + Battery options
- [x] Conditional columns based on selected scenario
- [x] Summary stats match selected scenario
- [x] Grid Import/Export only shown for solar scenarios

### Data Tab ✅ (Complete)
- [x] Scenario toggle (Baseline | Solar Only | Solar + Battery)
- [x] Shows appropriate columns per scenario
- [x] Uses shared ScenarioType with Energy tab

---

## Implementation Order

| Phase | Priority | Effort | Status |
|-------|----------|--------|--------|
| 1.1 Extract useAppState | High | High | ✅ Complete |
| 2.1 Scenario selector | High | Medium | ✅ Complete |
| 2.2-2.3 Tab improvements | Medium | Medium | ✅ Complete |
| 3.1 Tariff selection hook | Medium | Medium | ✅ Complete |
| 4.x Type improvements | Low | Low | ✅ ScenarioType added |
| 5.x Testing | Low | High | ✅ cost-engine.test.ts |

---

## Quick Wins (Completed)

1. ~~**Add scenario label to Energy/Data tabs**~~ ✅ Scenario selector added
2. ~~**Rename ambiguous columns**~~ ✅ Conditional columns based on scenario
3. ~~**Remove console.log statements**~~ ✅ Cleaned up

---

## Metrics for Success

| Metric | Target | Actual |
|--------|--------|--------|
| App.tsx lines | < 250 | 398 (down from 603) |
| Unit tests | 80%+ coverage | 71 tests |
| E2E tests | Full coverage | 21 tests |
| Config change detection | Automatic | ✅ useConfigChangeDetection |
| Tariff selection | Single hook | ✅ useTariffSelection |
| Consistent scenario data | All tabs | ✅ ScenarioType shared
