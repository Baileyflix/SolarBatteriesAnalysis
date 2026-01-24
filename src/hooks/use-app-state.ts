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
import type { ConsumptionTimeSeries, GenerationTimeSeries, TariffConfig } from '@/types';
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
    systemCost: 10000,
    monthlyDirectDebit: 150,
  };
}

/**
 * Connection data received from the connect dialog
 */
export interface ConnectionData {
  apiKey: string;
  accountNumber: string;
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
  
  /** Current scenario configuration */
  config: ScenarioConfig;
  
  /** UI state */
  ui: {
    isDark: boolean;
    activeTab: string;
    selectedScenario: 'solarOnly' | 'withSolar';
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
    setSelectedScenario: (scenario: 'solarOnly' | 'withSolar') => void;
    toggleTheme: () => void;
    setTheme: (dark: boolean) => void;
  };
}

/**
 * Central app state management hook
 */
export function useAppState(): AppState {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [storedApiKey, setStoredApiKey] = useState('');
  const [storedAccountNumber, setStoredAccountNumber] = useState('');

  // Stored data from API calls
  const [storedConsumption, setStoredConsumption] = useState<ConsumptionTimeSeries | null>(null);
  const [storedGeneration, setStoredGeneration] = useState<GenerationTimeSeries | null>(null);
  const [storedPostcode, setStoredPostcode] = useState('');
  const [storedDateRange, setStoredDateRange] = useState<{ from: string; to: string } | null>(null);
  const [storedActualTariffConfig, setStoredActualTariffConfig] = useState<TariffConfig | null>(null);

  // Scenario configuration
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig>(createDefaultConfig);

  // UI state
  const [activeTab, setActiveTab] = useState('results');
  const [selectedScenario, setSelectedScenario] = useState<'solarOnly' | 'withSolar'>('withSolar');
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
    
    // Clear stored data
    setStoredConsumption(null);
    setStoredGeneration(null);
    setStoredPostcode('');
    setStoredDateRange(null);
    setStoredActualTariffConfig(null);
    
    // Reset config to defaults
    setScenarioConfig(createDefaultConfig());
    
    // Clear localStorage
    localStorage.removeItem('solar-calculator-preferences');
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
