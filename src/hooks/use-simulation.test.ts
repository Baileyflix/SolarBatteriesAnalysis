/**
 * Unit tests for the simulation hook
 * These tests verify expected behavior BEFORE refactoring
 * 
 * Run with: npm run test:unit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSimulation } from './use-simulation';
import type { ConsumptionTimeSeries, GenerationTimeSeries, BatteryConfig, TariffConfig, TariffRatePeriod } from '@/types';

// Mock data generators
function createMockConsumption(days: number = 30): ConsumptionTimeSeries {
    const records = [];
    const baseDate = new Date('2025-01-01T00:00:00Z');

    for (let day = 0; day < days; day++) {
        for (let halfHour = 0; halfHour < 48; halfHour++) {
            const timestamp = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000 + halfHour * 30 * 60 * 1000);
            records.push({
                intervalStart: timestamp.toISOString(),
                intervalEnd: new Date(timestamp.getTime() + 30 * 60 * 1000).toISOString(),
                consumption: 0.5, // 0.5 kWh per half hour = 24 kWh/day
            });
        }
    }

    return { records };
}

function createMockGeneration(days: number = 30, dailyKwh: number = 15): GenerationTimeSeries {
    const records = [];
    const baseDate = new Date('2025-01-01T00:00:00Z');

    for (let day = 0; day < days; day++) {
        // Solar generation concentrated between 6am-6pm (24 half-hour slots)
        for (let halfHour = 0; halfHour < 48; halfHour++) {
            const timestamp = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000 + halfHour * 30 * 60 * 1000);
            const isSunnyPeriod = halfHour >= 12 && halfHour < 36; // 6am to 6pm
            records.push({
                intervalStart: timestamp.toISOString(),
                generation: isSunnyPeriod ? dailyKwh / 24 : 0, // Spread generation across sunny hours
            });
        }
    }

    return { records };
}

const mockBatteryConfig: BatteryConfig = {
    capacityKwh: 10,
    maxChargePowerKw: 5,
    maxDischargePowerKw: 5,
    roundTripEfficiency: 0.9,
    minSocPercent: 10,
    maxSocPercent: 100,
    initialSocPercent: 50,
};

const mockNoBattery: BatteryConfig = {
    ...mockBatteryConfig,
    capacityKwh: 0,
};

const mockFlatTariff: TariffConfig = {
    import: {
        type: 'flat',
        standardRatePence: 24.5,
        standingChargePence: 46.34,
    },
    export: {
        name: 'SEG',
        ratePence: 4.1,
    },
};

const mockFluxTariff: TariffConfig = {
    import: {
        type: 'tou',
        standardRatePence: 24.36,
        offPeakRatePence: 10.36,
        peakRatePence: 33.36,
        standingChargePence: 40.44,
        offPeakHoursStart: 2,
        offPeakHoursEnd: 5,
    },
    export: {
        name: 'Flux Export',
        ratePence: 25,
        peakExportRatePence: 25,
    },
};

describe('useSimulation hook', () => {
    describe('initial state', () => {
        it('should have null values before running simulation', () => {
            const { result } = renderHook(() => useSimulation());

            expect(result.current.actualSpend).toBeNull();
            expect(result.current.baseline).toBeNull();
            expect(result.current.solarOnly).toBeNull();
            expect(result.current.withSolar).toBeNull();
            expect(result.current.comparison).toBeNull();
            expect(result.current.roi).toBeNull();
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
        });
    });

    describe('runSimulation', () => {
        it('should calculate baseline (no solar, no battery)', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockNoBattery,
                    tariff: mockFlatTariff,
                });
            });

            await waitFor(() => {
                expect(result.current.baseline).not.toBeNull();
            });

            // Baseline should have full import (no solar)
            expect(result.current.baseline!.totalImportKwh).toBeGreaterThan(0);
            expect(result.current.baseline!.totalExportKwh).toBe(0);
        });

        it('should calculate solarOnly scenario', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockNoBattery,
                    tariff: mockFlatTariff,
                });
            });

            await waitFor(() => {
                expect(result.current.solarOnly).not.toBeNull();
            });

            // Solar only should have some export (excess solar during day)
            expect(result.current.solarOnly!.totalGenerationKwh).toBeGreaterThan(0);
            // Grid import should be less than baseline
            expect(result.current.solarOnly!.totalImportKwh)
                .toBeLessThan(result.current.baseline!.totalImportKwh);
        });

        it('should calculate withSolar (solar + battery) scenario', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockBatteryConfig,
                    tariff: mockFlatTariff,
                });
            });

            await waitFor(() => {
                expect(result.current.withSolar).not.toBeNull();
            });

            // With battery should have some stored energy usage
            // Net cost should generally be less than or equal to solar only
            // (battery allows time-shifting of solar)
        });

        it('should calculate comparison between baseline and withSolar', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockBatteryConfig,
                    tariff: mockFlatTariff,
                    systemCostPounds: 10000,
                });
            });

            await waitFor(() => {
                expect(result.current.comparison).not.toBeNull();
            });

            // Should have positive savings (solar reduces costs)
            expect(result.current.comparison!.annualSavingsPounds).toBeGreaterThan(0);
        });

        it('should calculate ROI based on system cost', async () => {
            const { result } = renderHook(() => useSimulation());
            const systemCost = 10000;

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockBatteryConfig,
                    tariff: mockFlatTariff,
                    systemCostPounds: systemCost,
                });
            });

            await waitFor(() => {
                expect(result.current.roi).not.toBeNull();
            });

            // ROI should be based on annual savings vs system cost
            const expectedPaybackYears = systemCost / (result.current.comparison?.annualSavingsPounds || 1);
            expect(result.current.roi!.paybackYears).toBeCloseTo(expectedPaybackYears, 0);
        });
    });

    describe('actualSpend calculation', () => {
        it('should return null actualSpend when no actual tariff provided', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockBatteryConfig,
                    tariff: mockFlatTariff,
                });
            });

            await waitFor(() => {
                expect(result.current.baseline).not.toBeNull();
            });

            // No actualTariff provided, so actualSpend should be null
            expect(result.current.actualSpend).toBeNull();
        });

        it('should calculate actualSpend when actual tariff provided', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockBatteryConfig,
                    tariff: mockFluxTariff, // Simulation tariff
                    actualTariff: mockFlatTariff, // User's actual tariff
                });
            });

            await waitFor(() => {
                expect(result.current.actualSpend).not.toBeNull();
            });

            // actualSpend should be calculated using the user's actual tariff
            expect(result.current.actualSpend!.totalNetCostPounds).toBeGreaterThan(0);
        });

        it('should use half-hourly rates for TOU tariffs when provided', async () => {
            const { result } = renderHook(() => useSimulation());

            // Create mock half-hourly rates for a TOU tariff
            const mockRates: TariffRatePeriod[] = [];
            const baseDate = new Date('2025-01-01T00:00:00Z');
            for (let day = 0; day < 30; day++) {
                for (let halfHour = 0; halfHour < 48; halfHour++) {
                    const validFrom = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000 + halfHour * 30 * 60 * 1000);
                    const validTo = new Date(validFrom.getTime() + 30 * 60 * 1000);
                    // Night rate (02:00-05:00) = 10p, Peak (16:00-19:00) = 30p, Standard = 22p
                    const hour = halfHour / 2;
                    let rate = 22;
                    if (hour >= 2 && hour < 5) rate = 10;
                    else if (hour >= 16 && hour < 19) rate = 30;

                    mockRates.push({
                        validFrom: validFrom.toISOString(),
                        validTo: validTo.toISOString(),
                        ratePence: rate,
                    });
                }
            }

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockBatteryConfig,
                    tariff: mockFluxTariff,
                    actualTariff: mockFluxTariff,
                    actualTariffRates: mockRates,
                });
            });

            await waitFor(() => {
                expect(result.current.actualSpend).not.toBeNull();
            });

            // With TOU rates, actualSpend should reflect varied pricing
            expect(result.current.actualSpend!.totalImportCostPounds).toBeGreaterThan(0);
        });
    });

    describe('reset', () => {
        it('should clear all simulation results', async () => {
            const { result } = renderHook(() => useSimulation());

            // First run a simulation
            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockBatteryConfig,
                    tariff: mockFlatTariff,
                });
            });

            await waitFor(() => {
                expect(result.current.withSolar).not.toBeNull();
            });

            // Then reset
            act(() => {
                result.current.reset();
            });

            expect(result.current.actualSpend).toBeNull();
            expect(result.current.baseline).toBeNull();
            expect(result.current.solarOnly).toBeNull();
            expect(result.current.withSolar).toBeNull();
            expect(result.current.comparison).toBeNull();
            expect(result.current.roi).toBeNull();
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
        });
    });

    describe('energy balance invariants', () => {
        it('consumption should equal self-consumed + grid import', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockNoBattery,
                    tariff: mockFlatTariff,
                });
            });

            await waitFor(() => {
                expect(result.current.solarOnly).not.toBeNull();
            });

            const solar = result.current.solarOnly!;
            const selfConsumed = solar.totalGenerationKwh - solar.totalExportKwh;
            const energySupplied = selfConsumed + solar.totalImportKwh;

            // Energy supplied should approximately equal consumption
            expect(energySupplied).toBeCloseTo(solar.totalConsumptionKwh, 0);
        });

        it('baseline should have zero generation and export', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockBatteryConfig,
                    tariff: mockFlatTariff,
                });
            });

            await waitFor(() => {
                expect(result.current.baseline).not.toBeNull();
            });

            // Baseline = no solar system
            expect(result.current.baseline!.totalGenerationKwh).toBe(0);
            expect(result.current.baseline!.totalExportKwh).toBe(0);
            // All consumption must come from grid
            expect(result.current.baseline!.totalImportKwh).toBe(result.current.baseline!.totalConsumptionKwh);
        });
    });

    describe('financial invariants', () => {
        it('net cost should equal import cost + standing charge - export revenue', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockNoBattery,
                    tariff: mockFlatTariff,
                });
            });

            await waitFor(() => {
                expect(result.current.solarOnly).not.toBeNull();
            });

            const solar = result.current.solarOnly!;
            const expectedNetCost = solar.totalImportCostPounds + solar.totalStandingChargePounds - solar.totalExportRevenuePounds;

            expect(solar.totalNetCostPounds).toBeCloseTo(expectedNetCost, 1);
        });

        it('savings should be baseline cost minus scenario cost', async () => {
            const { result } = renderHook(() => useSimulation());

            act(() => {
                result.current.runSimulation({
                    consumption: createMockConsumption(30),
                    generation: createMockGeneration(30, 15),
                    battery: mockBatteryConfig,
                    tariff: mockFlatTariff,
                });
            });

            await waitFor(() => {
                expect(result.current.comparison).not.toBeNull();
            });

            const baseline = result.current.baseline!;
            const withSolar = result.current.withSolar!;
            const expectedSavings = baseline.totalNetCostPounds - withSolar.totalNetCostPounds;

            expect(result.current.comparison!.annualSavingsPounds).toBeCloseTo(expectedSavings, 1);
        });
    });
});
