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
    aggregateToDaily,
    createAnnualSummary,
} from '@/lib/daily-simulator';

interface UseSimulationParams {
    consumption: ConsumptionTimeSeries;
    generation: GenerationTimeSeries;
    battery: BatteryConfig;
    tariff: TariffConfig;
    monthlyDirectDebitPounds?: number;
    /** Cost of the solar panels alone - basis for Solar Only payback */
    pvSystemCostPounds?: number;
    /** Cost of the battery alone - basis for Battery Only payback (Solar + Battery payback uses both combined) */
    batteryCostPounds?: number;
    /** Whether Battery Only may sell stored charge back to the grid for arbitrage profit (default: pure self-consumption) */
    allowBatteryOnlyExport?: boolean;
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
    /** Battery only (no solar), charged off-peak from the grid, on selected tariff */
    batteryOnly: AnnualFinancialSummary | null;
    /** Solar + battery on selected tariff */
    withSolar: AnnualFinancialSummary | null;
    /** Comparison/ROI for Solar + Battery (default/headline basis) - alias for withSolarComparison/withSolarRoi */
    comparison: ScenarioComparison | null;
    roi: ROICalculation | null;
    /** Comparison/ROI for Solar Only, using the PV-only cost */
    solarOnlyComparison: ScenarioComparison | null;
    solarOnlyRoi: ROICalculation | null;
    /** Comparison/ROI for Battery Only, using the battery-only cost */
    batteryOnlyComparison: ScenarioComparison | null;
    batteryOnlyRoi: ROICalculation | null;
    /** Comparison/ROI for Solar + Battery, using PV + battery cost combined */
    withSolarComparison: ScenarioComparison | null;
    withSolarRoi: ROICalculation | null;
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
    const [batteryOnly, setBatteryOnly] = useState<AnnualFinancialSummary | null>(null);
    const [withSolar, setWithSolar] = useState<AnnualFinancialSummary | null>(null);
    const [pvSystemCost, setPvSystemCost] = useState<number>(6000);
    const [batteryCost, setBatteryCost] = useState<number>(4000);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runSimulation = useCallback((params: UseSimulationParams) => {
        setLoading(true);
        setError(null);

        // Store costs for ROI calculation
        setPvSystemCost(params.pvSystemCostPounds ?? 6000);
        setBatteryCost(params.batteryCostPounds ?? 4000);

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
            const baselineResult = {
                ...createAnnualSummary(baselineMonthly),
                dailyBreakdown: aggregateToDaily(baselineFlows, params.tariff),
            };

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
            const solarOnlyResult = {
                ...createAnnualSummary(solarOnlyMonthly),
                dailyBreakdown: aggregateToDaily(solarOnlyFlows, params.tariff),
            };

            // Step 3c: Calculate BATTERY ONLY (no solar, battery charged off-peak from grid)
            // By default this is pure self-consumption - it never sells stored charge back
            // to the grid, even on tariffs with a good export rate (e.g. Flux). Without
            // solar, "export" would only ever be grid-charged energy resold for
            // arbitrage/trading profit, which isn't what most people mean by "battery only".
            // Zeroing the export rate disables that path (see canExportAtPeak in
            // simulateDailyEnergyFlows) while leaving off-peak charging - which is
            // independent of export price - fully intact. Set allowBatteryOnlyExport to
            // opt back into arbitrage/trading behaviour on tariffs where it's worthwhile.
            const batteryOnlyTariff: TariffConfig = params.allowBatteryOnlyExport
                ? params.tariff
                : { ...params.tariff, export: { ...params.tariff.export, ratePence: 0 } };
            const batteryOnlyFlows = simulateDailyEnergyFlows(
                dailyConsumption,
                dailyGeneration.map((g) => ({ ...g, generationKwh: 0 })),
                params.battery, // Keep real battery config
                batteryOnlyTariff
            );
            const batteryOnlyMonthly = aggregateToMonthly(batteryOnlyFlows, batteryOnlyTariff);
            const batteryOnlyResult = {
                ...createAnnualSummary(batteryOnlyMonthly),
                dailyBreakdown: aggregateToDaily(batteryOnlyFlows, batteryOnlyTariff),
            };

            // Step 3 & 4 & 5: Calculate WITH SOLAR + BATTERY + ARBITRAGE
            const solarFlows = simulateDailyEnergyFlows(dailyConsumption, dailyGeneration, params.battery, params.tariff);
            const solarMonthly = aggregateToMonthly(solarFlows, params.tariff);
            const solarResult = {
                ...createAnnualSummary(solarMonthly),
                dailyBreakdown: aggregateToDaily(solarFlows, params.tariff),
            };

            setActualSpend(actualSpendResult);
            setBaseline(baselineResult);
            setSolarOnly(solarOnlyResult);
            setBatteryOnly(batteryOnlyResult);
            setWithSolar(solarResult);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Simulation failed';
            setError(message);
            setActualSpend(null);
            setBaseline(null);
            setSolarOnly(null);
            setBatteryOnly(null);
            setWithSolar(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Step 6: "Potential savings" should always be measured against what the user
    // actually pays today (their real tariff, real consumption, no solar/battery)
    // whenever that's known - not against a hypothetical "no solar" cost on
    // whatever tariff happens to be selected for the simulation.
    const referenceResult = useMemo<AnnualFinancialSummary | null>(() => {
        if (actualSpend && !isNaN(actualSpend.totalNetCostPounds)) return actualSpend;
        return baseline;
    }, [actualSpend, baseline]);

    const solarOnlyComparison = useMemo<ScenarioComparison | null>(() => {
        if (!referenceResult || !solarOnly) return null;
        return Simulator.compareScenarios(referenceResult, solarOnly);
    }, [referenceResult, solarOnly]);

    const batteryOnlyComparison = useMemo<ScenarioComparison | null>(() => {
        if (!referenceResult || !batteryOnly) return null;
        return Simulator.compareScenarios(referenceResult, batteryOnly);
    }, [referenceResult, batteryOnly]);

    const withSolarComparison = useMemo<ScenarioComparison | null>(() => {
        if (!referenceResult || !withSolar) return null;
        return Simulator.compareScenarios(referenceResult, withSolar);
    }, [referenceResult, withSolar]);

    // Step 7: Calculate ROI per scenario, each against its own cost basis
    const solarOnlyRoi = useMemo<ROICalculation | null>(() => {
        if (!solarOnlyComparison) return null;
        return Simulator.calculateROI(solarOnlyComparison.annualSavingsPounds, pvSystemCost);
    }, [solarOnlyComparison, pvSystemCost]);

    const batteryOnlyRoi = useMemo<ROICalculation | null>(() => {
        if (!batteryOnlyComparison) return null;
        return Simulator.calculateROI(batteryOnlyComparison.annualSavingsPounds, batteryCost);
    }, [batteryOnlyComparison, batteryCost]);

    const withSolarRoi = useMemo<ROICalculation | null>(() => {
        if (!withSolarComparison) return null;
        return Simulator.calculateROI(withSolarComparison.annualSavingsPounds, pvSystemCost + batteryCost);
    }, [withSolarComparison, pvSystemCost, batteryCost]);

    const reset = useCallback(() => {
        setActualSpend(null);
        setBaseline(null);
        setSolarOnly(null);
        setBatteryOnly(null);
        setWithSolar(null);
        setPvSystemCost(6000);
        setBatteryCost(4000);
        setError(null);
        setLoading(false);
    }, []);

    return {
        actualSpend,
        baseline,
        solarOnly,
        batteryOnly,
        withSolar,
        comparison: withSolarComparison,
        roi: withSolarRoi,
        solarOnlyComparison,
        solarOnlyRoi,
        batteryOnlyComparison,
        batteryOnlyRoi,
        withSolarComparison,
        withSolarRoi,
        loading,
        error,
        runSimulation,
        reset,
    };
}
