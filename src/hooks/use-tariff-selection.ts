/**
 * useTariffSelection - Manages tariff selection for simulations
 *
 * This hook encapsulates the logic for:
 * 1. Switching between preset tariffs and user's actual tariff
 * 2. Converting ActualTariffInfo to TariffConfig format
 * 3. Providing a clean API for the config panel
 *
 * This simplifies App.tsx by removing inline tariff conversion logic.
 */

import { useCallback } from 'react';
import type { ActualTariffInfo, TariffConfig } from '@/types';
import type { ScenarioConfig } from '@/components/scenario-config-panel';

interface UseTariffSelectionParams {
    /** Current scenario config */
    scenarioConfig: ScenarioConfig;
    /** User's actual import tariff (if fetched) */
    importTariff: ActualTariffInfo | null;
    /** User's actual export tariff (if fetched) */
    exportTariff: { displayName?: string; unitRatePence: number } | null;
    /** Callback to update config */
    setConfig: (config: ScenarioConfig) => void;
}

interface UseTariffSelectionReturn {
    /** Whether user's actual tariff is available */
    hasActualTariff: boolean;
    /** Whether currently using the actual tariff */
    isUsingActualTariff: boolean;
    /** Switch to using the user's actual tariff */
    selectActualTariff: (() => void) | undefined;
    /** The actual tariff info (for display in config panel) */
    actualTariffInfo: ActualTariffInfo | null;
}

/**
 * Convert ActualTariffInfo to TariffConfig format
 */
function buildTariffConfigFromActual(
    importTariff: ActualTariffInfo,
    exportTariff: { displayName?: string; unitRatePence: number } | null
): TariffConfig {
    return {
        import: {
            type: importTariff.isVariable ? 'agile' : 'flat',
            standardRatePence: importTariff.unitRatePence,
            standingChargePence: importTariff.standingChargePence,
        },
        export: {
            name: exportTariff?.displayName ?? 'Standard Export',
            ratePence: exportTariff?.unitRatePence ?? 15.0,
        },
    };
}

/**
 * Hook for managing tariff selection in the scenario config
 */
export function useTariffSelection({
    scenarioConfig,
    importTariff,
    exportTariff,
    setConfig,
}: UseTariffSelectionParams): UseTariffSelectionReturn {
    const hasActualTariff = importTariff !== null;
    const isUsingActualTariff = scenarioConfig.tariffPreset === 'myTariff';

    const selectActualTariff = useCallback(() => {
        if (!importTariff) return;

        const tariffConfig = buildTariffConfigFromActual(importTariff, exportTariff);

        setConfig({
            ...scenarioConfig,
            tariffPreset: 'myTariff' as const,
            tariff: tariffConfig,
        });
    }, [importTariff, exportTariff, scenarioConfig, setConfig]);

    return {
        hasActualTariff,
        isUsingActualTariff,
        selectActualTariff: hasActualTariff ? selectActualTariff : undefined,
        actualTariffInfo: importTariff,
    };
}
