/**
 * Unit tests for config change detection
 * These tests capture expected behavior BEFORE refactoring
 * 
 * Run with: npm run test:unit
 */

import { describe, it, expect } from 'vitest';
import type { TariffConfig, BatteryConfig } from '@/types';

// This is the current logic from App.tsx that we'll extract
// Having tests ensures we don't break behavior during refactoring

interface ScenarioConfig {
    pvPreset: string;
    pvSystem: {
        systemSizeKwp: number;
        performanceRatio: number;
    };
    batteryPreset: string;
    battery: BatteryConfig;
    tariffPreset: string;
    tariff: TariffConfig;
    systemCost: number;
    monthlyDirectDebit: number;
}

/**
 * Current config change detection logic (from App.tsx)
 * This is what we're extracting into a hook
 */
function hasConfigChanged(last: ScenarioConfig, current: ScenarioConfig): boolean {
    return (
        last.battery.capacityKwh !== current.battery.capacityKwh ||
        last.tariffPreset !== current.tariffPreset ||
        last.tariff.import.standardRatePence !== current.tariff.import.standardRatePence ||
        last.tariff.export.ratePence !== current.tariff.export.ratePence ||
        last.systemCost !== current.systemCost ||
        last.monthlyDirectDebit !== current.monthlyDirectDebit ||
        last.pvSystem.systemSizeKwp !== current.pvSystem.systemSizeKwp
    );
}

/**
 * Proposed improved config change detection (deep comparison)
 * This is what we'll refactor to
 */
function hasConfigChangedDeep(last: ScenarioConfig, current: ScenarioConfig): boolean {
    return JSON.stringify(last) !== JSON.stringify(current);
}

// Test fixture helpers
function createBaseConfig(): ScenarioConfig {
    return {
        pvPreset: 'medium',
        pvSystem: {
            systemSizeKwp: 5,
            performanceRatio: 0.8,
        },
        batteryPreset: 'medium',
        battery: {
            capacityKwh: 10,
            maxChargePowerKw: 5,
            maxDischargePowerKw: 5,
            roundTripEfficiency: 0.9,
            minSocPercent: 10,
            maxSocPercent: 100,
            initialSocPercent: 50,
        },
        tariffPreset: 'octopusFlux',
        tariff: {
            import: {
                type: 'tou',
                standardRatePence: 24.36,
                offPeakRatePence: 10.36,
                peakRatePence: 33.36,
                standingChargePence: 40.44,
            },
            export: {
                name: 'Flux Export',
                ratePence: 25,
            },
        },
        systemCost: 10000,
        monthlyDirectDebit: 150,
    };
}

describe('Config Change Detection', () => {
    describe('current implementation (hasConfigChanged)', () => {
        it('should return false when configs are identical', () => {
            const config = createBaseConfig();
            const cloned = JSON.parse(JSON.stringify(config));

            expect(hasConfigChanged(config, cloned)).toBe(false);
        });

        it('should detect battery capacity changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.battery.capacityKwh = 15;

            expect(hasConfigChanged(last, current)).toBe(true);
        });

        it('should detect tariff preset changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.tariffPreset = 'flat';

            expect(hasConfigChanged(last, current)).toBe(true);
        });

        it('should detect import rate changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.tariff.import.standardRatePence = 30;

            expect(hasConfigChanged(last, current)).toBe(true);
        });

        it('should detect export rate changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.tariff.export.ratePence = 15;

            expect(hasConfigChanged(last, current)).toBe(true);
        });

        it('should detect system cost changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.systemCost = 15000;

            expect(hasConfigChanged(last, current)).toBe(true);
        });

        it('should detect monthly direct debit changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.monthlyDirectDebit = 200;

            expect(hasConfigChanged(last, current)).toBe(true);
        });

        it('should detect PV system size changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.pvSystem.systemSizeKwp = 8;

            expect(hasConfigChanged(last, current)).toBe(true);
        });

        // KNOWN LIMITATION: Current implementation misses some fields
        it('should NOT detect performance ratio changes (KNOWN LIMITATION)', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.pvSystem.performanceRatio = 0.75;

            // This is a BUG in current implementation - it doesn't check performanceRatio
            expect(hasConfigChanged(last, current)).toBe(false);
        });

        it('should NOT detect battery efficiency changes (KNOWN LIMITATION)', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.battery.roundTripEfficiency = 0.85;

            // This is a BUG - efficiency change should trigger recalc
            expect(hasConfigChanged(last, current)).toBe(false);
        });

        it('should NOT detect standing charge changes (KNOWN LIMITATION)', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.tariff.import.standingChargePence = 50;

            // This is a BUG - standing charge affects cost calculation
            expect(hasConfigChanged(last, current)).toBe(false);
        });
    });

    describe('improved implementation (hasConfigChangedDeep)', () => {
        it('should return false when configs are identical', () => {
            const config = createBaseConfig();
            const cloned = JSON.parse(JSON.stringify(config));

            expect(hasConfigChangedDeep(config, cloned)).toBe(false);
        });

        it('should detect ALL field changes including performance ratio', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.pvSystem.performanceRatio = 0.75;

            expect(hasConfigChangedDeep(last, current)).toBe(true);
        });

        it('should detect battery efficiency changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.battery.roundTripEfficiency = 0.85;

            expect(hasConfigChangedDeep(last, current)).toBe(true);
        });

        it('should detect standing charge changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.tariff.import.standingChargePence = 50;

            expect(hasConfigChangedDeep(last, current)).toBe(true);
        });

        it('should detect nested battery SoC changes', () => {
            const last = createBaseConfig();
            const current = createBaseConfig();
            current.battery.minSocPercent = 20;

            expect(hasConfigChangedDeep(last, current)).toBe(true);
        });
    });
});

describe('PV System Change Detection (for regeneration)', () => {
    // Current implementation: needs regeneration when PV system changes
    function needsPvRegeneration(
        previous: { systemSizeKwp: number; performanceRatio: number } | null,
        current: { systemSizeKwp: number; performanceRatio: number }
    ): boolean {
        if (!previous) return false;
        return (
            previous.systemSizeKwp !== current.systemSizeKwp ||
            previous.performanceRatio !== current.performanceRatio
        );
    }

    it('should return false when no previous config', () => {
        const current = { systemSizeKwp: 5, performanceRatio: 0.8 };
        expect(needsPvRegeneration(null, current)).toBe(false);
    });

    it('should return false when configs are identical', () => {
        const config = { systemSizeKwp: 5, performanceRatio: 0.8 };
        expect(needsPvRegeneration(config, { ...config })).toBe(false);
    });

    it('should return true when system size changes', () => {
        const previous = { systemSizeKwp: 5, performanceRatio: 0.8 };
        const current = { systemSizeKwp: 8, performanceRatio: 0.8 };
        expect(needsPvRegeneration(previous, current)).toBe(true);
    });

    it('should return true when performance ratio changes', () => {
        const previous = { systemSizeKwp: 5, performanceRatio: 0.8 };
        const current = { systemSizeKwp: 5, performanceRatio: 0.75 };
        expect(needsPvRegeneration(previous, current)).toBe(true);
    });
});
