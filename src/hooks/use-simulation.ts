import { useState, useCallback, useMemo } from 'react';
import type {
    ConsumptionTimeSeries,
    GenerationTimeSeries,
    BatteryConfig,
    TariffConfig,
    AnnualFinancialSummary,
    ScenarioComparison,
    ROICalculation,
    DailyConsumption,
    DailyGeneration,
    TariffRatePeriod,
} from '@/types';
import { Simulator } from '@/lib/simulator';
import {
    simulateDailyEnergyFlows,
    aggregateToMonthly,
    createAnnualSummary,
} from '@/lib/daily-simulator';

interface UseSimulationParams {
    consumption: ConsumptionTimeSeries;
    generation: GenerationTimeSeries;
    battery: BatteryConfig;
    tariff: TariffConfig;
    monthlyDirectDebitPounds?: number;
    systemCostPounds?: number;
    /** User's actual tariff for calculating real historical spend */
    actualTariff?: TariffConfig;
    /** Half-hourly rates for accurate TOU calculations on actual tariff */
    actualTariffRates?: TariffRatePeriod[];
}

interface UseSimulationResult {
    /** What the user actually spent (using their real tariff) */
    actualSpend: AnnualFinancialSummary | null;
    /** What no-solar would cost on the selected tariff */
    baseline: AnnualFinancialSummary | null;
    /** Solar only (no battery) on selected tariff */
    solarOnly: AnnualFinancialSummary | null;
    /** Solar + battery on selected tariff */
    withSolar: AnnualFinancialSummary | null;
    comparison: ScenarioComparison | null;
    roi: ROICalculation | null;
    loading: boolean;
    error: string | null;
    runSimulation: (params: UseSimulationParams) => void;
    reset: () => void;
}

/**
 * Aggregate half-hourly consumption records to daily
 */
function aggregateConsumptionToDaily(records: ConsumptionTimeSeries['records']): DailyConsumption[] {
    const dailyMap = new Map<string, number>();

    for (const record of records) {
        const date = record.intervalStart.split('T')[0];
        const existing = dailyMap.get(date) ?? 0;
        dailyMap.set(date, existing + record.consumption);
    }

    return Array.from(dailyMap.entries())
        .map(([date, consumptionKwh]) => ({ date, consumptionKwh }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregate half-hourly generation records to daily
 */
function aggregateGenerationToDaily(records: GenerationTimeSeries['records']): DailyGeneration[] {
    const dailyMap = new Map<string, number>();

    for (const record of records) {
        const date = record.intervalStart.split('T')[0];
        const existing = dailyMap.get(date) ?? 0;
        dailyMap.set(date, existing + record.generation);
    }

    return Array.from(dailyMap.entries())
        .map(([date, generationKwh]) => ({ date, generationKwh }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate actual costs using half-hourly consumption and half-hourly rates
 * This gives accurate TOU tariff costs
 */
function calculateActualCostsWithTOURates(
    consumption: ConsumptionTimeSeries,
    tariff: TariffConfig,
    rates: TariffRatePeriod[]
): AnnualFinancialSummary {
    // Create a map of rates for fast lookup
    const rateMap = new Map<number, number>();
    for (const rate of rates) {
        const from = new Date(rate.validFrom).getTime();
        const to = new Date(rate.validTo).getTime();
        // Store rate for each half-hour slot in the period
        for (let time = from; time < to; time += 30 * 60 * 1000) {
            rateMap.set(time, rate.ratePence);
        }
    }

    // Calculate cost for each consumption interval
    const monthlyMap = new Map<string, {
        consumptionKwh: number;
        importCostPence: number;
        days: Set<string>;
    }>();

    for (const record of consumption.records) {
        const timestamp = new Date(record.intervalStart);
        const month = record.intervalStart.substring(0, 7); // YYYY-MM
        const date = record.intervalStart.substring(0, 10); // YYYY-MM-DD

        // Get rate for this time slot
        const timeKey = timestamp.getTime();
        const ratePence = rateMap.get(timeKey) ?? tariff.import.standardRatePence;

        const costPence = record.consumption * ratePence;

        const existing = monthlyMap.get(month) ?? {
            consumptionKwh: 0,
            importCostPence: 0,
            days: new Set<string>()
        };
        existing.consumptionKwh += record.consumption;
        existing.importCostPence += costPence;
        existing.days.add(date);
        monthlyMap.set(month, existing);
    }

    // Convert to monthly summaries
    const monthlyBreakdown = Array.from(monthlyMap.entries()).map(([month, data]) => {
        const standingChargePounds = (data.days.size * tariff.import.standingChargePence) / 100;
        const importCostPounds = data.importCostPence / 100;
        const netCostPounds = importCostPounds + standingChargePounds;

        return {
            month,
            daysInMonth: data.days.size,
            totalConsumptionKwh: Math.round(data.consumptionKwh * 10) / 10,
            totalGenerationKwh: 0,
            gridImportKwh: Math.round(data.consumptionKwh * 10) / 10,
            gridExportKwh: 0,
            importCostPounds: Math.round(importCostPounds * 100) / 100,
            exportRevenuePounds: 0,
            standingChargePounds: Math.round(standingChargePounds * 100) / 100,
            netCostPounds: Math.round(netCostPounds * 100) / 100,
        };
    }).sort((a, b) => a.month.localeCompare(b.month));

    return createAnnualSummary(monthlyBreakdown);
}

/**
 * Custom hook for running the full simulation
 * 
 * CALCULATION FLOW (single source of truth):
 * 1. Aggregate consumption data to daily totals
 * 2. Aggregate generation data to daily totals  
 * 3. Run energy flow simulation (calculates import/export per day)
 * 4. Aggregate to monthly summaries with financial calculations
 * 5. Create annual summary
 * 6. Compare baseline vs with-solar scenarios
 * 7. Calculate ROI based on savings and system cost
 */
export function useSimulation(): UseSimulationResult {
    const [actualSpend, setActualSpend] = useState<AnnualFinancialSummary | null>(null);
    const [baseline, setBaseline] = useState<AnnualFinancialSummary | null>(null);
    const [solarOnly, setSolarOnly] = useState<AnnualFinancialSummary | null>(null);
    const [withSolar, setWithSolar] = useState<AnnualFinancialSummary | null>(null);
    const [systemCost, setSystemCost] = useState<number>(10000);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runSimulation = useCallback((params: UseSimulationParams) => {
        setLoading(true);
        setError(null);

        // Store system cost for ROI calculation
        setSystemCost(params.systemCostPounds ?? 10000);

        try {
            // Step 1 & 2: Aggregate to daily for simpler, more accurate calculations
            const dailyConsumption = aggregateConsumptionToDaily(params.consumption.records);
            const dailyGeneration = aggregateGenerationToDaily(params.generation.records);

            // Step 3 & 4 & 5: Calculate BASELINE (no solar, no battery, no arbitrage)
            const baselineFlows = simulateDailyEnergyFlows(
                dailyConsumption,
                dailyGeneration.map((g) => ({ ...g, generationKwh: 0 })),
                { ...params.battery, capacityKwh: 0 },
                undefined // No arbitrage for baseline
            );
            const baselineMonthly = aggregateToMonthly(baselineFlows, params.tariff);
            const baselineResult = createAnnualSummary(baselineMonthly);

            // Calculate ACTUAL SPEND using user's real tariff (if provided)
            // This is a fixed reference point showing what they actually paid
            // Use half-hourly rates for TOU tariffs for accurate calculation
            let actualSpendResult: AnnualFinancialSummary | null = null;
            if (params.actualTariff) {
                if (params.actualTariffRates && params.actualTariffRates.length > 0) {
                    // Use half-hourly rates for accurate TOU calculation
                    actualSpendResult = calculateActualCostsWithTOURates(
                        params.consumption,
                        params.actualTariff,
                        params.actualTariffRates
                    );
                } else {
                    // Fallback to flat rate calculation
                    const actualMonthly = aggregateToMonthly(baselineFlows, params.actualTariff);
                    actualSpendResult = createAnnualSummary(actualMonthly);
                }
            }

            // Step 3b: Calculate SOLAR ONLY (solar panels, no battery)
            const solarOnlyFlows = simulateDailyEnergyFlows(
                dailyConsumption,
                dailyGeneration,
                { ...params.battery, capacityKwh: 0 }, // Zero battery capacity
                undefined // No arbitrage without battery
            );
            const solarOnlyMonthly = aggregateToMonthly(solarOnlyFlows, params.tariff);
            const solarOnlyResult = createAnnualSummary(solarOnlyMonthly);

            // Step 3 & 4 & 5: Calculate WITH SOLAR + BATTERY + ARBITRAGE
            const solarFlows = simulateDailyEnergyFlows(dailyConsumption, dailyGeneration, params.battery, params.tariff);
            const solarMonthly = aggregateToMonthly(solarFlows, params.tariff);
            const solarResult = createAnnualSummary(solarMonthly);

            setActualSpend(actualSpendResult);
            setBaseline(baselineResult);
            setSolarOnly(solarOnlyResult);
            setWithSolar(solarResult);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Simulation failed';
            setError(message);
            setActualSpend(null);
            setBaseline(null);
            setSolarOnly(null);
            setWithSolar(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Step 6: Compare scenarios (derived from baseline and withSolar)
    const comparison = useMemo<ScenarioComparison | null>(() => {
        if (!baseline || !withSolar) return null;
        return Simulator.compareScenarios(baseline, withSolar);
    }, [baseline, withSolar]);

    // Step 7: Calculate ROI (derived from comparison and systemCost)
    const roi = useMemo<ROICalculation | null>(() => {
        if (!comparison) return null;
        return Simulator.calculateROI(comparison.annualSavingsPounds, systemCost);
    }, [comparison, systemCost]);

    const reset = useCallback(() => {
        setActualSpend(null);
        setBaseline(null);
        setSolarOnly(null);
        setWithSolar(null);
        setSystemCost(10000);
        setError(null);
        setLoading(false);
    }, []);

    return {
        actualSpend,
        baseline,
        solarOnly,
        withSolar,
        comparison,
        roi,
        loading,
        error,
        runSimulation,
        reset,
    };
}
