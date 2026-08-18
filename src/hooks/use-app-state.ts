/**
 * useAppState - Centralized state management hook for the Solar Calculator
 * 
 * This hook extracts all the core application state from App.tsx, providing:
 * - Connection state (isConnected, credentials, dialog open)
 * - Stored data (consumption, generation, postcode, dateRange, tariff config)
 * - Scenario configuration (PV, battery, tariff presets and custom values)
 * - UI state (theme, active tab, selected scenario)
 * 
 * Benefits:
 * - Single source of truth for app state
 * - Testable in isolation
 * - Clear separation between state and UI
 * - Reduces App.tsx to pure composition
 */

import { useState, useCallback, useEffect } from 'react';
import { UK_BATTERY_PRESETS } from '@/lib/battery-engine';
import { UK_PV_PRESETS } from '@/lib/solar-generator';
import { UK_TARIFF_PRESETS } from '@/lib/cost-engine';
import { loadSession, saveSession, clearSession } from '@/lib/session-persistence';
import { useLiveTariffRates } from '@/hooks/use-live-tariff-rates';
import type { LiveTariffRatesState } from '@/hooks/use-live-tariff-rates';
import type { ConsumptionTimeSeries, GenerationTimeSeries, TariffConfig, ScenarioType } from '@/types';
import type { ScenarioConfig } from '@/components/scenario-config-panel';

// Re-export for backward compatibility
export type { ScenarioConfig };

/**
 * Creates a fresh default configuration
 * Returns a new object each time to avoid shared references
 */
export function createDefaultConfig(): ScenarioConfig {
    return {
        pvPreset: 'medium',
        pvSystem: {
            systemSizeKwp: UK_PV_PRESETS.medium.systemSizeKwp,
            performanceRatio: UK_PV_PRESETS.medium.performanceRatio,
        },
        batteryPreset: 'medium',
        battery: { ...UK_BATTERY_PRESETS.medium },
        tariffPreset: 'octopusFlux',
        tariff: {
            import: { ...UK_TARIFF_PRESETS.octopusFlux.import },
            export: { ...UK_TARIFF_PRESETS.octopusFlux.export },
        },
        pvSystemCost: 6000,
        batteryCost: 4000,
        monthlyDirectDebit: 150,
        batteryOnlyAllowExport: false,
    };
}

/**
 * Connection data received from the connect dialog
 */
export interface ConnectionData {
    apiKey: string;
    accountNumber: string;
    mpan: string;
    serialNumber: string;
    postcode: string;
    dateRange: { from: string; to: string };
}

/**
 * Hook return type - structured for clarity
 */
export interface AppState {
    /** Connection-related state */
    connection: {
        isConnected: boolean;
        dialogOpen: boolean;
        apiKey: string;
        accountNumber: string;
        mpan: string;
        serialNumber: string;
    };

    /** Data stored from API calls */
    storedData: {
        consumption: ConsumptionTimeSeries | null;
        generation: GenerationTimeSeries | null;
        postcode: string;
        dateRange: { from: string; to: string } | null;
        actualTariffConfig: TariffConfig | null;
        /** Derived: true when generation data exists */
        hasStoredGeneration: boolean;
        /** Derived: true when consumption data exists */
        hasStoredConsumption: boolean;
    };

    /** Live Octopus tariff rates for the connected postcode's GSP region */
    liveTariffRates: LiveTariffRatesState;

    /** Current scenario configuration */
    config: ScenarioConfig;

    /** UI state */
    ui: {
        isDark: boolean;
        activeTab: string;
        selectedScenario: ScenarioType;
    };

    /** Actions to modify state */
    actions: {
        // Connection dialog
        openConnectDialog: () => void;
        closeConnectDialog: () => void;
        setConnectDialogOpen: (open: boolean) => void;

        // Connection state
        setConnected: (connected: boolean) => void;
        disconnect: () => void;

        // Store data
        storeConnectionData: (data: ConnectionData) => void;
        storeConsumption: (data: ConsumptionTimeSeries) => void;
        storeGeneration: (data: GenerationTimeSeries) => void;
        storeActualTariffConfig: (config: TariffConfig) => void;

        // Config
        setConfig: (config: ScenarioConfig) => void;

        // UI
        setActiveTab: (tab: string) => void;
        setSelectedScenario: (scenario: ScenarioType) => void;
        toggleTheme: () => void;
        setTheme: (dark: boolean) => void;
    };
}

/**
 * Central app state management hook
 */
export function useAppState(): AppState {
    // Read any previously persisted session once, at mount - reused below to
    // hydrate state so a reload doesn't require re-entering the API key.
    const [persisted] = useState(loadSession);

    // Connection state
    const [isConnected, setIsConnected] = useState(() => persisted !== null);
    const [connectDialogOpen, setConnectDialogOpen] = useState(false);
    const [storedApiKey, setStoredApiKey] = useState(() => persisted?.apiKey ?? '');
    const [storedAccountNumber, setStoredAccountNumber] = useState(() => persisted?.accountNumber ?? '');
    const [storedMpan, setStoredMpan] = useState(() => persisted?.mpan ?? '');
    const [storedSerialNumber, setStoredSerialNumber] = useState(() => persisted?.serialNumber ?? '');

    // Stored data from API calls
    const [storedConsumption, setStoredConsumption] = useState<ConsumptionTimeSeries | null>(() => persisted?.consumption ?? null);
    const [storedGeneration, setStoredGeneration] = useState<GenerationTimeSeries | null>(() => persisted?.generation ?? null);
    const [storedPostcode, setStoredPostcode] = useState(() => persisted?.postcode ?? '');
    const [storedDateRange, setStoredDateRange] = useState<{ from: string; to: string } | null>(() => persisted?.dateRange ?? null);
    const [storedActualTariffConfig, setStoredActualTariffConfig] = useState<TariffConfig | null>(() => persisted?.actualTariffConfig ?? null);

    // Live Octopus tariff rates for the connected postcode's GSP region
    const liveTariffRates = useLiveTariffRates(storedPostcode);

    // Scenario configuration
    const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig>(() => persisted?.scenarioConfig ?? createDefaultConfig());

    // Persist the session whenever connected data changes, so a reload can
    // skip straight back to the dashboard instead of the connect dialog.
    useEffect(() => {
        if (!isConnected || !storedDateRange) return;
        saveSession({
            version: 1,
            apiKey: storedApiKey,
            accountNumber: storedAccountNumber,
            mpan: storedMpan,
            serialNumber: storedSerialNumber,
            postcode: storedPostcode,
            dateRange: storedDateRange,
            consumption: storedConsumption,
            generation: storedGeneration,
            actualTariffConfig: storedActualTariffConfig,
            scenarioConfig,
        });
    }, [
        isConnected,
        storedApiKey,
        storedAccountNumber,
        storedMpan,
        storedSerialNumber,
        storedPostcode,
        storedDateRange,
        storedConsumption,
        storedGeneration,
        storedActualTariffConfig,
        scenarioConfig,
    ]);

    // UI state
    const [activeTab, setActiveTab] = useState('results');
    const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('withSolar');
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark') ||
                window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // Sync theme with DOM
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', isDark);
        }
    }, [isDark]);

    // Actions
    const openConnectDialog = useCallback(() => setConnectDialogOpen(true), []);
    const closeConnectDialog = useCallback(() => setConnectDialogOpen(false), []);

    const storeConnectionData = useCallback((data: ConnectionData) => {
        setStoredPostcode(data.postcode);
        setStoredDateRange(data.dateRange);
        setStoredApiKey(data.apiKey);
        setStoredAccountNumber(data.accountNumber);
        setStoredMpan(data.mpan);
        setStoredSerialNumber(data.serialNumber);
    }, []);

    const storeConsumption = useCallback((data: ConsumptionTimeSeries) => {
        setStoredConsumption(data);
    }, []);

    const storeGeneration = useCallback((data: GenerationTimeSeries) => {
        setStoredGeneration(data);
    }, []);

    const storeActualTariffConfig = useCallback((config: TariffConfig) => {
        setStoredActualTariffConfig(config);
    }, []);

    const setConnected = useCallback((connected: boolean) => {
        setIsConnected(connected);
    }, []);

    const disconnect = useCallback(() => {
        // Clear connection state
        setIsConnected(false);
        setStoredApiKey('');
        setStoredAccountNumber('');
        setStoredMpan('');
        setStoredSerialNumber('');

        // Clear stored data
        setStoredConsumption(null);
        setStoredGeneration(null);
        setStoredPostcode('');
        setStoredDateRange(null);
        setStoredActualTariffConfig(null);

        // Reset config to defaults
        setScenarioConfig(createDefaultConfig());

        // Clear persisted session
        clearSession();
    }, []);

    const setConfig = useCallback((config: ScenarioConfig) => {
        setScenarioConfig(config);
    }, []);

    const toggleTheme = useCallback(() => {
        setIsDark(prev => !prev);
    }, []);

    const setTheme = useCallback((dark: boolean) => {
        setIsDark(dark);
    }, []);

    return {
        connection: {
            isConnected,
            dialogOpen: connectDialogOpen,
            apiKey: storedApiKey,
            accountNumber: storedAccountNumber,
            mpan: storedMpan,
            serialNumber: storedSerialNumber,
        },
        storedData: {
            consumption: storedConsumption,
            generation: storedGeneration,
            postcode: storedPostcode,
            dateRange: storedDateRange,
            actualTariffConfig: storedActualTariffConfig,
            hasStoredGeneration: storedGeneration !== null,
            hasStoredConsumption: storedConsumption !== null,
        },
        liveTariffRates,
        config: scenarioConfig,
        ui: {
            isDark,
            activeTab,
            selectedScenario,
        },
        actions: {
            openConnectDialog,
            closeConnectDialog,
            setConnectDialogOpen,
            setConnected,
            disconnect,
            storeConnectionData,
            storeConsumption,
            storeGeneration,
            storeActualTariffConfig,
            setConfig,
            setActiveTab,
            setSelectedScenario,
            toggleTheme,
            setTheme,
        },
    };
}
