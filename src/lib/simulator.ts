import type {
    ConsumptionTimeSeries,
    GenerationTimeSeries,
    BatteryConfig,
    TariffConfig,
    MonthlyFinancialSummary,
    AnnualFinancialSummary,
    ScenarioComparison,
    ROICalculation,
    RunningBalance,
} from '@/types';
import { BatteryEngine } from './battery-engine';
import { CostEngine } from './cost-engine';

/**
 * Complete simulation configuration
 */
export interface SimulationConfig {
    consumption: ConsumptionTimeSeries;
    generation: GenerationTimeSeries;
    battery: BatteryConfig;
    tariff: TariffConfig;
    monthlyDirectDebitPounds?: number;
    systemCostPounds?: number;
    /** Half-hourly rates for TOU tariff calculations */
    halfHourlyRates?: import('@/types').TariffRatePeriod[];
}

/**
 * Main simulation orchestrator
 * Coordinates battery dispatch, cost calculations, and financial analysis
 */
export class Simulator {
    private readonly config: SimulationConfig;
    private readonly batteryEngine: BatteryEngine;
    private readonly costEngine: CostEngine;

    constructor(config: SimulationConfig) {
        this.config = config;
        this.batteryEngine = new BatteryEngine(config.battery);
        this.costEngine = new CostEngine(config.tariff, config.halfHourlyRates);
    }

    /**
     * Run complete simulation and generate annual financial summary
     */
    runSimulation(): AnnualFinancialSummary {
        this.batteryEngine.reset();

        // Align consumption and generation records by timestamp
        const alignedRecords = this.alignRecords();

        // Process each half-hourly interval
        const intervalResults = alignedRecords.map((record) => {
            const batteryFlow = this.batteryEngine.processInterval(
                record.generation,
                record.consumption,
                record.intervalStart,
                record.intervalEnd
            );

            const intervalCost = this.costEngine.calculateIntervalCost(
                record.intervalStart,
                batteryFlow.gridImportKwh,
                batteryFlow.gridExportKwh
            );

            return {
                ...record,
                ...batteryFlow,
                ...intervalCost,
            };
        });

        // Aggregate into monthly summaries
        const monthlyBreakdown = this.aggregateMonthly(intervalResults);

        // Calculate annual totals
        const totalConsumptionKwh = monthlyBreakdown.reduce(
            (sum, month) => sum + month.totalConsumptionKwh,
            0
        );
        const totalGenerationKwh = monthlyBreakdown.reduce(
            (sum, month) => sum + month.totalGenerationKwh,
            0
        );
        const totalImportKwh = monthlyBreakdown.reduce(
            (sum, month) => sum + month.gridImportKwh,
            0
        );
        const totalExportKwh = monthlyBreakdown.reduce(
            (sum, month) => sum + month.gridExportKwh,
            0
        );
        const totalImportCostPounds = monthlyBreakdown.reduce(
            (sum, month) => sum + month.importCostPounds,
            0
        );
        const totalExportRevenuePounds = monthlyBreakdown.reduce(
            (sum, month) => sum + month.exportRevenuePounds,
            0
        );
        const totalStandingChargePounds = monthlyBreakdown.reduce(
            (sum, month) => sum + month.standingChargePounds,
            0
        );
        const totalNetCostPounds = monthlyBreakdown.reduce(
            (sum, month) => sum + month.netCostPounds,
            0
        );

        const year = new Date(this.config.consumption.periodStart).getFullYear().toString();

        return {
            year,
            totalConsumptionKwh: Math.round(totalConsumptionKwh * 10) / 10,
            totalGenerationKwh: Math.round(totalGenerationKwh * 10) / 10,
            totalImportKwh: Math.round(totalImportKwh * 10) / 10,
            totalExportKwh: Math.round(totalExportKwh * 10) / 10,
            totalImportCostPounds: Math.round(totalImportCostPounds * 100) / 100,
            totalExportRevenuePounds: Math.round(totalExportRevenuePounds * 100) / 100,
            totalStandingChargePounds: Math.round(totalStandingChargePounds * 100) / 100,
            totalNetCostPounds: Math.round(totalNetCostPounds * 100) / 100,
            monthlyBreakdown,
        };
    }

    /**
     * Normalize a timestamp to a consistent format for comparison
     * Handles differences like:
     * - 2025-01-23T00:00:00Z vs 2025-01-23T00:00:00.000Z
     * - 2025-01-23T00:00:00+00:00 vs 2025-01-23T00:00:00Z
     */
    private normalizeTimestamp(timestamp: string): string {
        const date = new Date(timestamp);
        // Round to the nearest minute to handle any millisecond differences
        date.setSeconds(0, 0);
        return date.toISOString();
    }

    /**
     * Align consumption and generation records by timestamp
     */
    private alignRecords(): Array<{
        intervalStart: string;
        intervalEnd: string;
        consumption: number;
        generation: number;
    }> {
        // Build generation map with normalized timestamps
        const generationMap = new Map(
            this.config.generation.records.map((r) => [this.normalizeTimestamp(r.intervalStart), r.generation])
        );

        const aligned = this.config.consumption.records.map((consumptionRecord) => {
            const normalizedKey = this.normalizeTimestamp(consumptionRecord.intervalStart);
            return {
                intervalStart: consumptionRecord.intervalStart,
                intervalEnd: consumptionRecord.intervalEnd,
                consumption: consumptionRecord.consumption,
                generation: generationMap.get(normalizedKey) ?? 0,
            };
        });

        return aligned;
    }

    /**
     * Aggregate half-hourly results into monthly summaries
     */
    private aggregateMonthly(
        intervalResults: Array<{
            intervalStart: string;
            consumption: number;
            generation: number;
            gridImportKwh: number;
            gridExportKwh: number;
            importCostPence: number;
            exportRevenuePence: number;
            netCostPence: number;
        }>
    ): MonthlyFinancialSummary[] {
        const monthlyMap = new Map<string, typeof intervalResults>();

        // Group by year-month
        for (const result of intervalResults) {
            const date = new Date(result.intervalStart);
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            const existing = monthlyMap.get(yearMonth) ?? [];
            existing.push(result);
            monthlyMap.set(yearMonth, existing);
        }

        const summaries: MonthlyFinancialSummary[] = [];

        for (const [month, intervals] of monthlyMap.entries()) {
            const daysInMonth = this.getDaysInMonth(month);

            const totalConsumptionKwh = intervals.reduce((sum, i) => sum + i.consumption, 0);
            const totalGenerationKwh = intervals.reduce((sum, i) => sum + i.generation, 0);
            const gridImportKwh = intervals.reduce((sum, i) => sum + i.gridImportKwh, 0);
            const gridExportKwh = intervals.reduce((sum, i) => sum + i.gridExportKwh, 0);
            const importCostPence = intervals.reduce((sum, i) => sum + i.importCostPence, 0);
            const exportRevenuePence = intervals.reduce((sum, i) => sum + i.exportRevenuePence, 0);

            const standingChargePounds = CostEngine.penceToPounds(
                this.config.tariff.import.standingChargePence * daysInMonth
            );
            const importCostPounds = CostEngine.penceToPounds(importCostPence);
            const exportRevenuePounds = CostEngine.penceToPounds(exportRevenuePence);
            const netCostPounds = importCostPounds + standingChargePounds - exportRevenuePounds;

            const directDebitPounds = this.config.monthlyDirectDebitPounds;
            const monthlyBalancePounds = directDebitPounds
                ? Math.round((directDebitPounds - netCostPounds) * 100) / 100
                : undefined;

            summaries.push({
                month,
                daysInMonth,
                totalConsumptionKwh: Math.round(totalConsumptionKwh * 10) / 10,
                totalGenerationKwh: Math.round(totalGenerationKwh * 10) / 10,
                gridImportKwh: Math.round(gridImportKwh * 10) / 10,
                gridExportKwh: Math.round(gridExportKwh * 10) / 10,
                importCostPounds: Math.round(importCostPounds * 100) / 100,
                exportRevenuePounds: Math.round(exportRevenuePounds * 100) / 100,
                standingChargePounds: Math.round(standingChargePounds * 100) / 100,
                netCostPounds: Math.round(netCostPounds * 100) / 100,
                directDebitPounds,
                monthlyBalancePounds,
            });
        }

        summaries.sort((a, b) => a.month.localeCompare(b.month));

        return summaries;
    }

    /**
     * Get number of days in a given year-month
     */
    private getDaysInMonth(yearMonth: string): number {
        const [year, month] = yearMonth.split('-').map(Number);
        return new Date(year!, month!, 0).getDate();
    }

    /**
     * Calculate running balance for direct debit tracking
     */
    static calculateRunningBalance(monthlyData: MonthlyFinancialSummary[]): RunningBalance[] {
        let cumulativeBalance = 0;
        const balances: RunningBalance[] = [];

        for (const month of monthlyData) {
            if (month.directDebitPounds === undefined || month.monthlyBalancePounds === undefined) {
                continue;
            }

            cumulativeBalance += month.monthlyBalancePounds;

            balances.push({
                month: month.month,
                directDebitPounds: month.directDebitPounds,
                actualCostPounds: month.netCostPounds,
                monthlyBalancePounds: month.monthlyBalancePounds,
                cumulativeBalancePounds: Math.round(cumulativeBalance * 100) / 100,
            });
        }

        return balances;
    }

    /**
     * Compare baseline scenario (no solar) with solar+battery scenario
     */
    static compareScenarios(
        baseline: AnnualFinancialSummary,
        withSolar: AnnualFinancialSummary
    ): ScenarioComparison {
        const annualSavingsPounds =
            baseline.totalNetCostPounds - withSolar.totalNetCostPounds;

        const savingsPercentage = CostEngine.calculateSavingsPercentage(
            baseline.totalNetCostPounds,
            withSolar.totalNetCostPounds
        );

        // Self-consumption rate: % of generation used directly (not exported)
        const selfConsumedKwh = withSolar.totalGenerationKwh - withSolar.totalExportKwh;
        const selfConsumptionRate =
            withSolar.totalGenerationKwh > 0
                ? (selfConsumedKwh / withSolar.totalGenerationKwh) * 100
                : 0;

        // Self-sufficiency rate: % of consumption met by solar
        const selfSufficiencyRate =
            baseline.totalConsumptionKwh > 0
                ? (selfConsumedKwh / baseline.totalConsumptionKwh) * 100
                : 0;

        return {
            baseline,
            withSolar,
            annualSavingsPounds: Math.round(annualSavingsPounds * 100) / 100,
            savingsPercentage: Math.round(savingsPercentage * 10) / 10,
            selfConsumptionRate: Math.round(selfConsumptionRate * 10) / 10,
            selfSufficiencyRate: Math.round(selfSufficiencyRate * 10) / 10,
        };
    }

    /**
     * Calculate ROI metrics for the solar+battery investment
     */
    static calculateROI(
        annualSavingsPounds: number,
        systemCostPounds: number,
        incentivesPounds = 0
    ): ROICalculation {
        const netSystemCostPounds = systemCostPounds - incentivesPounds;
        const paybackYears =
            annualSavingsPounds > 0 ? netSystemCostPounds / annualSavingsPounds : Infinity;

        // Assume 25-year system lifetime (conservative)
        const lifetimeSavingsPounds = annualSavingsPounds * 25 - netSystemCostPounds;

        return {
            systemCostPounds: Math.round(systemCostPounds * 100) / 100,
            annualSavingsPounds: Math.round(annualSavingsPounds * 100) / 100,
            paybackYears: Math.round(paybackYears * 10) / 10,
            lifetimeSavingsPounds: Math.round(lifetimeSavingsPounds * 100) / 100,
            incentivesPounds: Math.round(incentivesPounds * 100) / 100,
            netSystemCostPounds: Math.round(netSystemCostPounds * 100) / 100,
        };
    }
}
