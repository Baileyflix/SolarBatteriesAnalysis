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
}

interface UseSimulationResult {
    baseline: AnnualFinancialSummary | null;
    solarOnly: AnnualFinancialSummary | null;
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

            setBaseline(baselineResult);
            setSolarOnly(solarOnlyResult);
            setWithSolar(solarResult);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Simulation failed';
            setError(message);
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
        setBaseline(null);
        setSolarOnly(null);
        setWithSolar(null);
        setSystemCost(10000);
        setError(null);
        setLoading(false);
    }, []);

    return {
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
