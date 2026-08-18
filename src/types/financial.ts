import type { DailyCostBreakdown } from './daily';

/**
 * Monthly financial summary comparing actual vs. simulated costs
 */
export interface MonthlyFinancialSummary {
    /** Month identifier in YYYY-MM format */
    month: string;

    /** Number of days in this month */
    daysInMonth: number;

    /** Total household consumption in kWh */
    totalConsumptionKwh: number;

    /** Total PV generation in kWh (0 if no solar) */
    totalGenerationKwh: number;

    /** Energy imported from grid in kWh */
    gridImportKwh: number;

    /** Energy exported to grid in kWh */
    gridExportKwh: number;

    /** Grid import cost in £ */
    importCostPounds: number;

    /** Export revenue in £ (SEG payments) */
    exportRevenuePounds: number;

    /** Monthly standing charges in £ */
    standingChargePounds: number;

    /** Net cost for the month in £ (import + standing - export) */
    netCostPounds: number;

    /** Actual monthly direct debit amount in £ (if available) */
    directDebitPounds?: number;

    /** Monthly balance: direct debit - net cost
     * Positive = credit (overpaid), Negative = debit (underpaid) */
    monthlyBalancePounds?: number;

    // Battery arbitrage metrics
    /** kWh charged from grid overnight at off-peak rate */
    overnightChargeKwh?: number;

    /** kWh exported during peak hours (16:00-19:00) */
    peakExportKwh?: number;

    /** Savings from buying cheap overnight vs. standard rate */
    arbitrageSavingsPounds?: number;
}

/**
 * Annual financial summary with ROI calculations
 */
export interface AnnualFinancialSummary {
    /** Year identifier (YYYY) */
    year: string;

    /** Total annual consumption in kWh */
    totalConsumptionKwh: number;

    /** Total annual PV generation in kWh */
    totalGenerationKwh: number;

    /** Total grid import in kWh */
    totalImportKwh: number;

    /** Total grid export in kWh */
    totalExportKwh: number;

    /** Total import costs in £ */
    totalImportCostPounds: number;

    /** Total export revenue in £ */
    totalExportRevenuePounds: number;

    /** Total standing charges in £ */
    totalStandingChargePounds: number;

    /** Total net cost for the year in £ */
    totalNetCostPounds: number;

    /** Breakdown by month */
    monthlyBreakdown: MonthlyFinancialSummary[];

    /** Optional day-by-day cost breakdown, for drilling into a specific month */
    dailyBreakdown?: DailyCostBreakdown[];
}

/**
 * Comparison between baseline (no solar/battery) and simulated scenario
 */
export interface ScenarioComparison {
    /** Financial summary for baseline scenario (current situation) */
    baseline: AnnualFinancialSummary;

    /** Financial summary with solar/battery installed */
    withSolar: AnnualFinancialSummary;

    /** Annual savings in £ (baseline cost - solar cost) */
    annualSavingsPounds: number;

    /** Percentage reduction in energy costs */
    savingsPercentage: number;

    /** Self-consumption rate (% of generation used directly) */
    selfConsumptionRate: number;

    /** Self-sufficiency rate (% of consumption met by solar) */
    selfSufficiencyRate: number;
}

/**
 * ROI calculation for solar/battery investment
 */
export interface ROICalculation {
    /** Total system cost in £ (PV + battery + installation) */
    systemCostPounds: number;

    /** Annual savings in £ */
    annualSavingsPounds: number;

    /** Simple payback period in years */
    paybackYears: number;

    /** 25-year total savings (assuming constant energy prices) */
    lifetimeSavingsPounds: number;

    /** Optional: Government grants/incentives received in £ */
    incentivesPounds?: number;

    /** Net system cost after incentives in £ */
    netSystemCostPounds: number;
}

/**
 * Running balance tracking for direct debit comparison
 */
export interface RunningBalance {
    /** Month identifier in YYYY-MM format */
    month: string;

    /** Direct debit paid this month in £ */
    directDebitPounds: number;

    /** Actual energy cost this month in £ */
    actualCostPounds: number;

    /** This month's balance (DD - cost) in £ */
    monthlyBalancePounds: number;

    /** Cumulative balance from start to this month in £
     * Positive = in credit, Negative = in debit */
    cumulativeBalancePounds: number;
}
