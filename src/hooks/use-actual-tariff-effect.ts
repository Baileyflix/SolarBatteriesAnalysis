/**
 * useActualTariffEffect - Handle the async tariff fetch and re-simulation
 * 
 * This hook encapsulates the logic for:
 * 1. Building TariffConfig from fetched actual tariff data
 * 2. Storing it in app state
 * 3. Re-running simulation once when tariff becomes available
 * 
 * This was previously inline in App.tsx, creating complexity.
 */

import { useRef, useEffect } from 'react';
import type { TariffConfig, ConsumptionTimeSeries, GenerationTimeSeries, ActualTariffInfo, TariffRatePeriod } from '@/types';
import type { ScenarioConfig } from '@/components/scenario-config-panel';

interface UseActualTariffEffectParams {
    // From actualTariff hook
    importTariff: ActualTariffInfo | null;
    exportTariff: ActualTariffInfo | null;
    loading: boolean;

    // Connection state
    isConnected: boolean;
    consumption: ConsumptionTimeSeries | null;
    generation: GenerationTimeSeries | null;
    storedActualTariffConfig: TariffConfig | null;

    // Config
    scenarioConfig: ScenarioConfig;

    // Actions
    storeActualTariffConfig: (config: TariffConfig) => void;
    runSimulation: (params: {
        consumption: ConsumptionTimeSeries;
        generation: GenerationTimeSeries;
        battery: ScenarioConfig['battery'];
        tariff: ScenarioConfig['tariff'];
        monthlyDirectDebitPounds?: number;
        systemCostPounds?: number;
        actualTariff?: TariffConfig;
        actualTariffRates?: TariffRatePeriod[];
    }) => void;
}

interface UseActualTariffEffectResult {
    /** Reset the "has run" flag - call on disconnect */
    reset: () => void;
}

/**
 * Manages the actual tariff fetch → store → re-simulate flow
 */
export function useActualTariffEffect({
    importTariff,
    exportTariff,
    loading,
    isConnected,
    consumption,
    generation,
    storedActualTariffConfig,
    scenarioConfig,
    storeActualTariffConfig,
    runSimulation,
}: UseActualTariffEffectParams): UseActualTariffEffectResult {
    // Track if we've already re-run simulation with actual tariff
    const hasRunWithActualTariffRef = useRef(false);

    useEffect(() => {
        if (!importTariff || loading) return;

        const tariffConfig: TariffConfig = {
            import: {
                type: 'flat', // Actual tariffs are treated as flat for simplicity
                standardRatePence: importTariff.unitRatePence,
                standingChargePence: importTariff.standingChargePence,
            },
            export: {
                name: exportTariff?.displayName ?? 'SEG',
                ratePence: exportTariff?.unitRatePence ?? 15, // Default export rate if no export tariff
            },
        };

        // Store tariff config if not already stored
        if (!storedActualTariffConfig) {
            storeActualTariffConfig(tariffConfig);
        }

        // Re-run simulation once when actual tariff becomes available
        // This ensures actualSpend is calculated after initial connect
        if (isConnected && consumption && generation && !hasRunWithActualTariffRef.current) {
            hasRunWithActualTariffRef.current = true;
            runSimulation({
                consumption,
                generation,
                battery: scenarioConfig.battery,
                tariff: scenarioConfig.tariff,
                monthlyDirectDebitPounds: scenarioConfig.monthlyDirectDebit || undefined,
                systemCostPounds: scenarioConfig.systemCost || undefined,
                actualTariff: tariffConfig,
                actualTariffRates: importTariff.halfHourlyRates,
            });
        }
    }, [
        importTariff,
        exportTariff,
        loading,
        isConnected,
        consumption,
        generation,
        storedActualTariffConfig,
        scenarioConfig,
        storeActualTariffConfig,
        runSimulation,
    ]);

    const reset = () => {
        hasRunWithActualTariffRef.current = false;
    };

    return { reset };
}
