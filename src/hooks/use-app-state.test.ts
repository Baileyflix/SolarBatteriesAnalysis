/**
 * Tests for useAppState hook
 * 
 * The useAppState hook centralizes all app-level state management:
 * - Connection state (isConnected, credentials)
 * - Stored data (consumption, generation, postcode, dateRange, tariff)
 * - Scenario configuration
 * - UI state (theme, active tab, selected scenario)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppState, createDefaultConfig } from './use-app-state';

describe('createDefaultConfig', () => {
    it('returns a valid default configuration', () => {
        const config = createDefaultConfig();

        expect(config.pvPreset).toBe('medium');
        expect(config.pvSystem.systemSizeKwp).toBeGreaterThan(0);
        expect(config.pvSystem.performanceRatio).toBeGreaterThan(0);
        expect(config.pvSystem.performanceRatio).toBeLessThanOrEqual(1);
        expect(config.batteryPreset).toBe('medium');
        expect(config.battery.capacityKwh).toBeGreaterThan(0);
        expect(config.tariffPreset).toBe('octopusFlux');
        expect(config.tariff.import).toBeDefined();
        expect(config.tariff.export).toBeDefined();
        expect(config.pvSystemCost).toBeGreaterThan(0);
        expect(config.batteryCost).toBeGreaterThan(0);
        expect(config.monthlyDirectDebit).toBeGreaterThan(0);
        expect(config.batteryOnlyAllowExport).toBe(false);
    });

    it('returns a new object each time', () => {
        const config1 = createDefaultConfig();
        const config2 = createDefaultConfig();

        expect(config1).not.toBe(config2);
        expect(config1.pvSystem).not.toBe(config2.pvSystem);
        expect(config1.battery).not.toBe(config2.battery);
        expect(config1.tariff).not.toBe(config2.tariff);
    });
});

describe('useAppState', () => {
    beforeEach(() => {
        // Reset localStorage between tests
        localStorage.clear();
    });

    describe('initial state', () => {
        it('starts disconnected with no stored data', () => {
            const { result } = renderHook(() => useAppState());

            expect(result.current.connection.isConnected).toBe(false);
            expect(result.current.connection.dialogOpen).toBe(false);
            expect(result.current.storedData.consumption).toBeNull();
            expect(result.current.storedData.generation).toBeNull();
            expect(result.current.storedData.postcode).toBe('');
            expect(result.current.storedData.dateRange).toBeNull();
            expect(result.current.storedData.actualTariffConfig).toBeNull();
        });

        it('starts with default scenario config', () => {
            const { result } = renderHook(() => useAppState());
            const defaultConfig = createDefaultConfig();

            expect(result.current.config.pvPreset).toBe(defaultConfig.pvPreset);
            expect(result.current.config.batteryPreset).toBe(defaultConfig.batteryPreset);
            expect(result.current.config.tariffPreset).toBe(defaultConfig.tariffPreset);
        });

        it('starts with results tab active', () => {
            const { result } = renderHook(() => useAppState());

            expect(result.current.ui.activeTab).toBe('results');
        });

        it('starts with withSolar scenario selected', () => {
            const { result } = renderHook(() => useAppState());

            expect(result.current.ui.selectedScenario).toBe('withSolar');
        });
    });

    describe('connection dialog', () => {
        it('can open the connection dialog', () => {
            const { result } = renderHook(() => useAppState());

            act(() => {
                result.current.actions.openConnectDialog();
            });

            expect(result.current.connection.dialogOpen).toBe(true);
        });

        it('can close the connection dialog', () => {
            const { result } = renderHook(() => useAppState());

            act(() => {
                result.current.actions.openConnectDialog();
            });
            expect(result.current.connection.dialogOpen).toBe(true);

            act(() => {
                result.current.actions.closeConnectDialog();
            });
            expect(result.current.connection.dialogOpen).toBe(false);
        });

        it('can toggle the connection dialog', () => {
            const { result } = renderHook(() => useAppState());

            act(() => {
                result.current.actions.setConnectDialogOpen(true);
            });
            expect(result.current.connection.dialogOpen).toBe(true);

            act(() => {
                result.current.actions.setConnectDialogOpen(false);
            });
            expect(result.current.connection.dialogOpen).toBe(false);
        });
    });

    describe('storing connection data', () => {
        it('can store connection details', () => {
            const { result } = renderHook(() => useAppState());

            act(() => {
                result.current.actions.storeConnectionData({
                    apiKey: 'test-api-key',
                    accountNumber: 'A-1234567',
                    postcode: 'SW1A 1AA',
                    dateRange: { from: '2024-01-01', to: '2024-12-31' },
                });
            });

            expect(result.current.storedData.postcode).toBe('SW1A 1AA');
            expect(result.current.storedData.dateRange).toEqual({ from: '2024-01-01', to: '2024-12-31' });
            expect(result.current.connection.apiKey).toBe('test-api-key');
            expect(result.current.connection.accountNumber).toBe('A-1234567');
        });

        it('can store consumption data', () => {
            const { result } = renderHook(() => useAppState());
            const mockConsumption = {
                periodStart: new Date('2024-01-01'),
                periodEnd: new Date('2024-12-31'),
                data: [{ timestamp: new Date('2024-01-01'), consumptionKwh: 1.5 }],
                totalKwh: 1.5,
                metadata: { source: 'test' as const },
            };

            act(() => {
                result.current.actions.storeConsumption(mockConsumption);
            });

            expect(result.current.storedData.consumption).toBe(mockConsumption);
        });

        it('can store generation data', () => {
            const { result } = renderHook(() => useAppState());
            const mockGeneration = {
                periodStart: new Date('2024-01-01'),
                periodEnd: new Date('2024-12-31'),
                data: [{ timestamp: new Date('2024-01-01'), generationKwh: 2.0 }],
                totalKwh: 2.0,
                systemConfig: { systemSizeKwp: 4.0, performanceRatio: 0.85 },
                metadata: { source: 'nasa-power' as const },
            };

            act(() => {
                result.current.actions.storeGeneration(mockGeneration);
            });

            expect(result.current.storedData.generation).toBe(mockGeneration);
        });

        it('can store actual tariff config', () => {
            const { result } = renderHook(() => useAppState());
            const mockTariffConfig = {
                import: { standardRatePence: 24.5, standingChargePence: 47.0 },
                export: { ratePence: 15.0 },
            };

            act(() => {
                result.current.actions.storeActualTariffConfig(mockTariffConfig);
            });

            expect(result.current.storedData.actualTariffConfig).toBe(mockTariffConfig);
        });

        it('can mark as connected', () => {
            const { result } = renderHook(() => useAppState());

            expect(result.current.connection.isConnected).toBe(false);

            act(() => {
                result.current.actions.setConnected(true);
            });

            expect(result.current.connection.isConnected).toBe(true);
        });
    });

    describe('disconnect', () => {
        it('clears all stored data on disconnect', () => {
            const { result } = renderHook(() => useAppState());

            // First connect and store data
            act(() => {
                result.current.actions.storeConnectionData({
                    apiKey: 'test-api-key',
                    accountNumber: 'A-1234567',
                    postcode: 'SW1A 1AA',
                    dateRange: { from: '2024-01-01', to: '2024-12-31' },
                });
                result.current.actions.setConnected(true);
            });

            expect(result.current.connection.isConnected).toBe(true);

            // Then disconnect
            act(() => {
                result.current.actions.disconnect();
            });

            expect(result.current.connection.isConnected).toBe(false);
            expect(result.current.storedData.postcode).toBe('');
            expect(result.current.storedData.dateRange).toBeNull();
            expect(result.current.storedData.consumption).toBeNull();
            expect(result.current.storedData.generation).toBeNull();
            expect(result.current.storedData.actualTariffConfig).toBeNull();
            expect(result.current.connection.apiKey).toBe('');
            expect(result.current.connection.accountNumber).toBe('');
        });

        it('resets config to defaults on disconnect', () => {
            const { result } = renderHook(() => useAppState());

            // Change config
            act(() => {
                result.current.actions.setConfig({
                    ...createDefaultConfig(),
                    pvPreset: 'large',
                    pvSystemCost: 20000,
                });
                result.current.actions.setConnected(true);
            });

            expect(result.current.config.pvPreset).toBe('large');

            // Disconnect
            act(() => {
                result.current.actions.disconnect();
            });

            const defaultConfig = createDefaultConfig();
            expect(result.current.config.pvPreset).toBe(defaultConfig.pvPreset);
            expect(result.current.config.pvSystemCost).toBe(defaultConfig.pvSystemCost);
        });

        it('clears localStorage on disconnect', () => {
            const { result } = renderHook(() => useAppState());

            localStorage.setItem('solar-calculator-preferences', 'test');

            act(() => {
                result.current.actions.disconnect();
            });

            expect(localStorage.getItem('solar-calculator-preferences')).toBeNull();
        });
    });

    describe('config management', () => {
        it('can update scenario config', () => {
            const { result } = renderHook(() => useAppState());

            const newConfig = {
                ...createDefaultConfig(),
                pvPreset: 'large' as const,
                pvSystemCost: 15000,
            };

            act(() => {
                result.current.actions.setConfig(newConfig);
            });

            expect(result.current.config.pvPreset).toBe('large');
            expect(result.current.config.pvSystemCost).toBe(15000);
        });
    });

    describe('UI state', () => {
        it('can change active tab', () => {
            const { result } = renderHook(() => useAppState());

            act(() => {
                result.current.actions.setActiveTab('energy');
            });

            expect(result.current.ui.activeTab).toBe('energy');

            act(() => {
                result.current.actions.setActiveTab('breakdown');
            });

            expect(result.current.ui.activeTab).toBe('breakdown');
        });

        it('can change selected scenario', () => {
            const { result } = renderHook(() => useAppState());

            act(() => {
                result.current.actions.setSelectedScenario('solarOnly');
            });

            expect(result.current.ui.selectedScenario).toBe('solarOnly');

            act(() => {
                result.current.actions.setSelectedScenario('withSolar');
            });

            expect(result.current.ui.selectedScenario).toBe('withSolar');
        });

        it('can toggle theme', () => {
            const { result } = renderHook(() => useAppState());

            const initialDark = result.current.ui.isDark;

            act(() => {
                result.current.actions.toggleTheme();
            });

            expect(result.current.ui.isDark).toBe(!initialDark);
        });

        it('can set theme explicitly', () => {
            const { result } = renderHook(() => useAppState());

            act(() => {
                result.current.actions.setTheme(true);
            });

            expect(result.current.ui.isDark).toBe(true);

            act(() => {
                result.current.actions.setTheme(false);
            });

            expect(result.current.ui.isDark).toBe(false);
        });
    });

    describe('derived state', () => {
        it('hasStoredGeneration is true when generation data exists', () => {
            const { result } = renderHook(() => useAppState());

            expect(result.current.storedData.hasStoredGeneration).toBe(false);

            act(() => {
                result.current.actions.storeGeneration({
                    periodStart: new Date('2024-01-01'),
                    periodEnd: new Date('2024-12-31'),
                    data: [{ timestamp: new Date('2024-01-01'), generationKwh: 2.0 }],
                    totalKwh: 2.0,
                    systemConfig: { systemSizeKwp: 4.0, performanceRatio: 0.85 },
                    metadata: { source: 'nasa-power' as const },
                });
            });

            expect(result.current.storedData.hasStoredGeneration).toBe(true);
        });

        it('hasStoredConsumption is true when consumption data exists', () => {
            const { result } = renderHook(() => useAppState());

            expect(result.current.storedData.hasStoredConsumption).toBe(false);

            act(() => {
                result.current.actions.storeConsumption({
                    periodStart: new Date('2024-01-01'),
                    periodEnd: new Date('2024-12-31'),
                    data: [{ timestamp: new Date('2024-01-01'), consumptionKwh: 1.5 }],
                    totalKwh: 1.5,
                    metadata: { source: 'test' as const },
                });
            });

            expect(result.current.storedData.hasStoredConsumption).toBe(true);
        });
    });
});
