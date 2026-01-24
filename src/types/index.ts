/**
 * Central export point for all domain types
 */

// Energy consumption data types
export type {
    ConsumptionRecord,
    ConsumptionTimeSeries,
    ConsumptionRequest,
} from './consumption';

// Solar PV generation types
export type {
    IrradianceRecord,
    GenerationRecord,
    GenerationTimeSeries,
    PVSystemConfig,
} from './generation';

// Daily data types (simplified)
export type {
    DailyEnergyRecord,
    DailyIrradiance,
    DailyGeneration,
    DailyConsumption,
} from './daily';

// Battery storage types
export type {
    BatteryState,
    BatteryIntervalFlow,
    BatteryConfig,
    BatteryDispatch,
} from './battery';

// Grid tariff and cost types
export type {
    ImportTariff,
    ExportTariff,
    TariffConfig,
    TariffRatePeriod,
    IntervalCost,
    DailyCost,
    ActualTariffInfo,
    ActualCostData,
    ActualCostSummary,
} from './tariff';

// Financial summary and ROI types
export type {
    MonthlyFinancialSummary,
    AnnualFinancialSummary,
    ScenarioComparison,
    ROICalculation,
    RunningBalance,
} from './financial';

// UI types
export type ScenarioType = 'baseline' | 'solarOnly' | 'withSolar';
