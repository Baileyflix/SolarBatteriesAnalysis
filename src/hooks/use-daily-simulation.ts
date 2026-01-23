import { useState, useCallback } from 'react';
import type {
    TariffConfig,
    BatteryConfig,
    PVSystemConfig,
    AnnualFinancialSummary,
    DailyConsumption,
    DailyIrradiance,
} from '@/types';
import { OctopusEnergyClient, OctopusEnergyError } from '@/services/octopus-energy';
import { SolarDataClient, SolarDataError, postcodeToCoordinates } from '@/services/solar-data';
import {
    calculateDailyGeneration,
    simulateDailyEnergyFlows,
    aggregateToMonthly,
    createAnnualSummary,
} from '@/lib/daily-simulator';

interface SimulationInput {
    apiKey: string;
    mpan: string;
    serialNumber: string;
    postcode: string;
    periodFrom: string;
    periodTo: string;
    pvSystem: PVSystemConfig;
    battery: BatteryConfig;
    tariff: TariffConfig;
}

interface UseDailySimulationResult {
    baseline: AnnualFinancialSummary | null;
    withSolar: AnnualFinancialSummary | null;
    loading: boolean;
    error: string | null;
    runSimulation: (input: SimulationInput) => Promise<void>;
    reset: () => void;
    // Debug data
    dailyConsumption: DailyConsumption[] | null;
    dailyIrradiance: DailyIrradiance[] | null;
}

/**
 * Simplified daily simulation hook
 * Uses daily data granularity for cleaner, more accurate calculations
 */
export function useDailySimulation(): UseDailySimulationResult {
    const [baseline, setBaseline] = useState<AnnualFinancialSummary | null>(null);
    const [withSolar, setWithSolar] = useState<AnnualFinancialSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dailyConsumption, setDailyConsumption] = useState<DailyConsumption[] | null>(null);
    const [dailyIrradiance, setDailyIrradiance] = useState<DailyIrradiance[] | null>(null);

    const runSimulation = useCallback(async (input: SimulationInput) => {
        setLoading(true);
        setError(null);

        try {
            // 1. Fetch daily consumption from Octopus
            const octopusClient = new OctopusEnergyClient(input.apiKey);
            const consumption = await octopusClient.fetchDailyConsumption({
                mpan: input.mpan,
                serialNumber: input.serialNumber,
                periodFrom: input.periodFrom,
                periodTo: input.periodTo,
                apiKey: input.apiKey,
            });
            setDailyConsumption(consumption);

            // 2. Get coordinates from postcode
            const location = await postcodeToCoordinates(input.postcode);

            // 3. Fetch daily irradiance from NASA POWER
            const solarClient = new SolarDataClient();
            const irradiance = await solarClient.fetchDailyIrradiance(
                location,
                input.periodFrom,
                input.periodTo
            );
            setDailyIrradiance(irradiance);

            // 4. Calculate daily generation
            const generation = calculateDailyGeneration(irradiance, input.pvSystem);

            // 5. Calculate baseline (no solar, no battery, no arbitrage)
            const baselineFlows = simulateDailyEnergyFlows(
                consumption,
                generation.map((g) => ({ ...g, generationKwh: 0 })), // Zero generation
                { ...input.battery, capacityKwh: 0 }, // No battery
                undefined // No arbitrage for baseline
            );
            const baselineMonthly = aggregateToMonthly(baselineFlows, input.tariff);
            const baselineResult = createAnnualSummary(baselineMonthly);
            setBaseline(baselineResult);

            // 6. Calculate with solar + battery + arbitrage (if time-of-use tariff)
            const solarFlows = simulateDailyEnergyFlows(consumption, generation, input.battery, input.tariff);
            const solarMonthly = aggregateToMonthly(solarFlows, input.tariff);
            const solarResult = createAnnualSummary(solarMonthly);
            setWithSolar(solarResult);

        } catch (err) {
            if (err instanceof OctopusEnergyError || err instanceof SolarDataError) {
                setError(err.message);
            } else {
                setError('An unexpected error occurred during simulation');
            }
            setBaseline(null);
            setWithSolar(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setBaseline(null);
        setWithSolar(null);
        setError(null);
        setLoading(false);
        setDailyConsumption(null);
        setDailyIrradiance(null);
    }, []);

    return {
        baseline,
        withSolar,
        loading,
        error,
        runSimulation,
        reset,
        dailyConsumption,
        dailyIrradiance,
    };
}
