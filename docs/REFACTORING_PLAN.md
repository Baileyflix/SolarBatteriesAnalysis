# Solar + Battery ROI Calculator - Refactoring Plan

## Executive Summary

This document outlines the current architecture issues, inconsistencies across tabs, and a refactoring plan to create a cleaner, more maintainable codebase.

---

## Current Architecture Overview

### Data Flow
```
User connects → Fetch consumption + solar data → Run simulation → Display across 3 tabs
                     ↓                              ↓
              actualTariff fetched       Produces: baseline, solarOnly, withSolar, actualSpend
                (async, after)
```

### Key Files
| File | Responsibility | LOC | Issues |
|------|---------------|-----|--------|
| `App.tsx` | **603 lines** - State management, data fetching, UI layout | Too large | God component, mixed concerns |
| `use-simulation.ts` | Calculation orchestration | 287 | Good separation |
| `daily-simulator.ts` | Energy flow simulation | 296 | Well-structured |
| `summary-metrics.tsx` | Hero stats + cost flow | 162 | Recently simplified |
| `cost-chart.tsx` | Monthly cost line chart | 144 | Clean |
| `energy-flow-chart.tsx` | Energy kWh visualization | 180 | Shows `withSolar` only |
| `results-table.tsx` | Monthly breakdown table | 92 | Shows `withSolar` only |

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

**Specific Issues:**
- Energy tab shows "Grid Import/Export" but these are *calculated* values for solar+battery, not raw data
- Data tab has no context about what scenario it's showing
- No way to compare scenarios side-by-side in Energy/Data tabs

### 3. Calculation Timing Issue (FIXED)
**Problem:** Initial connect doesn't include `actualSpend` because tariff fetch is async.
**Status:** Fixed with `hasRunWithActualTariffRef` pattern, but it's a workaround.

### 4. Config Change Detection is Fragile (MEDIUM)
**Problem:** Manual field-by-field comparison in `useEffect`:
```typescript
const hasChanged = 
  last.battery.capacityKwh !== current.battery.capacityKwh ||
  last.tariffPreset !== current.tariffPreset ||
  // ... 5 more comparisons
```
**Risk:** Easy to forget fields when adding new config options.

### 5. Multiple Sources of Truth for Tariff Data (MEDIUM)
**Problem:** Tariff information exists in multiple places:
- `scenarioConfig.tariff` - selected tariff for simulation
- `storedActualTariffConfig` - user's real tariff (TariffConfig)
- `actualTariff.importTariff` - fetched tariff info (ActualTariffInfo)
- `actualTariff.importTariff?.halfHourlyRates` - TOU rates

**Confusion:** Which to use where? Summary metrics uses all of them.

### 6. Simulation Hook Returns Too Many Things (LOW)
```typescript
return {
  actualSpend, baseline, solarOnly, withSolar,  // 4 scenarios
  comparison, roi,                               // derived values
  loading, error, runSimulation, reset          // state + actions
};
```
**Suggestion:** Split into computed/derived vs state/actions.

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

### Results Tab ✅ (Mostly Complete)
- [x] Shows "You Paid" (actualSpend)
- [x] Shows "Without Solar" (baseline on selected tariff)
- [x] Shows "Solar Only" vs "Solar + Battery"
- [x] Savings calculated vs correct reference (actualSpend if available)
- [ ] Clarify "Without Solar" is on *selected* tariff, not actual tariff

### Energy Tab ⚠️ (Needs Work)
- [ ] Currently shows `withSolar` only - add scenario selector
- [ ] "Grid Import" column is misleading - it's calculated, not actual
- [ ] Add comparison view: "What you actually imported" vs "What you would import"
- [ ] Summary stats should match Results tab calculations

### Data Tab ⚠️ (Needs Work)
- [ ] Add scenario toggle (Baseline | Solar Only | Solar + Battery)
- [ ] Add "Actual Spend" column when available
- [ ] Add column headers explaining data source
- [ ] Export to CSV option

---

## Implementation Order

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| 2.1 Scenario selector | High | Medium | None |
| 1.1 Extract useAppState | High | High | None |
| 3.1 Tariff context | Medium | Medium | Phase 1 |
| 2.2-2.3 Tab improvements | Medium | Medium | Phase 2.1 |
| 4.x Type improvements | Low | Low | Any time |
| 5.x Testing | Low | High | After Phase 1-3 |

---

## Quick Wins (Can Do Now)

1. **Add scenario label to Energy/Data tabs**
   - Simple text: "Showing: Solar + Battery scenario"
   - 5 minutes, improves clarity immediately

2. **Add explanatory text to Data tab**
   - "These are projected bills if you had solar + battery installed"
   - Match the Info box pattern from Results tab

3. **Rename ambiguous columns**
   - "Grid Import" → "Would Import (with Solar)"
   - "Grid Export" → "Would Export (with Solar)"

4. **Remove console.log statements**
   - Debug logging left in summary-metrics.tsx and App.tsx

---

## Metrics for Success

After refactoring:
- App.tsx < 250 lines
- No mixed concerns (fetching + UI in same component)
- All tabs show consistent scenario data
- Config changes detected automatically (no manual field list)
- Single source of truth for tariff data
- 80%+ test coverage on calculation engines
