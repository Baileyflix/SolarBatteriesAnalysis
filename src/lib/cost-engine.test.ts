import { describe, it, expect } from 'vitest';
import { CostEngine, UK_TARIFF_PRESETS } from './cost-engine';
import type { TariffConfig, TariffRatePeriod } from '@/types';

describe('CostEngine', () => {
    const flatTariff: TariffConfig = {
        import: {
            type: 'flat',
            standardRatePence: 24.5,
            standingChargePence: 47.43,
        },
        export: {
            name: 'Fixed Export',
            ratePence: 15.0,
        },
    };

    describe('calculateIntervalCost', () => {
        it('calculates import cost correctly for flat tariff', () => {
            const engine = new CostEngine(flatTariff);
            const result = engine.calculateIntervalCost(
                '2024-06-15T10:00:00Z',
                1.0, // 1 kWh import
                0   // no export
            );

            expect(result.importKwh).toBe(1);
            expect(result.importCostPence).toBe(24.5);
            expect(result.exportKwh).toBe(0);
            expect(result.exportRevenuePence).toBe(0);
            expect(result.netCostPence).toBe(24.5);
        });

        it('calculates export revenue correctly', () => {
            const engine = new CostEngine(flatTariff);
            const result = engine.calculateIntervalCost(
                '2024-06-15T12:00:00Z',
                0,   // no import
                2.0  // 2 kWh export
            );

            expect(result.importKwh).toBe(0);
            expect(result.importCostPence).toBe(0);
            expect(result.exportKwh).toBe(2);
            expect(result.exportRevenuePence).toBe(30); // 2 * 15p
            expect(result.netCostPence).toBe(-30); // Negative = earning
        });

        it('handles both import and export in same interval', () => {
            const engine = new CostEngine(flatTariff);
            const result = engine.calculateIntervalCost(
                '2024-06-15T14:00:00Z',
                0.5, // 0.5 kWh import
                1.5  // 1.5 kWh export
            );

            expect(result.importKwh).toBe(0.5);
            expect(result.importCostPence).toBe(12.25); // 0.5 * 24.5
            expect(result.exportKwh).toBe(1.5);
            expect(result.exportRevenuePence).toBe(22.5); // 1.5 * 15
            expect(result.netCostPence).toBe(-10.25); // Net earning
        });

        it('rounds values to avoid floating point issues', () => {
            const engine = new CostEngine(flatTariff);
            const result = engine.calculateIntervalCost(
                '2024-06-15T10:00:00Z',
                0.333,
                0.111
            );

            // Values should be rounded sensibly
            expect(result.importKwh).toBe(0.333);
            expect(result.exportKwh).toBe(0.111);
            expect(typeof result.importCostPence).toBe('number');
            expect(typeof result.netCostPence).toBe('number');
        });
    });

    describe('Time of Use rates', () => {
        const touRates: TariffRatePeriod[] = [
            // Cheap overnight rate
            { validFrom: '2024-06-15T00:30:00Z', validTo: '2024-06-15T04:30:00Z', ratePence: 7.0 },
            // Day rate
            { validFrom: '2024-06-15T04:30:00Z', validTo: '2024-06-16T00:30:00Z', ratePence: 24.5 },
        ];

        it('uses TOU rate when available', () => {
            const engine = new CostEngine(flatTariff, touRates);
            
            // During cheap period
            const nightResult = engine.calculateIntervalCost(
                '2024-06-15T02:00:00Z',
                1.0,
                0
            );
            expect(nightResult.importCostPence).toBe(7.0);

            // During day period
            const dayResult = engine.calculateIntervalCost(
                '2024-06-15T12:00:00Z',
                1.0,
                0
            );
            expect(dayResult.importCostPence).toBe(24.5);
        });

        it('falls back to flat rate when no TOU rate matches', () => {
            const engine = new CostEngine(flatTariff, touRates);
            
            // Time not covered by TOU rates
            const result = engine.calculateIntervalCost(
                '2024-06-14T12:00:00Z', // Day before TOU rates
                1.0,
                0
            );
            expect(result.importCostPence).toBe(24.5); // Flat rate fallback
        });
    });

    describe('aggregateDailyCosts', () => {
        it('aggregates multiple intervals into daily totals', () => {
            const engine = new CostEngine(flatTariff);
            
            // Create 48 half-hourly intervals for one day
            const intervals = [];
            for (let i = 0; i < 48; i++) {
                const hour = Math.floor(i / 2);
                const minute = (i % 2) * 30;
                const timestamp = `2024-06-15T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
                intervals.push(engine.calculateIntervalCost(timestamp, 0.25, 0.1));
            }

            const dailyCosts = engine.aggregateDailyCosts(intervals);

            expect(dailyCosts).toHaveLength(1);
            expect(dailyCosts[0]!.date).toBe('2024-06-15');
            expect(dailyCosts[0]!.totalImportKwh).toBe(12); // 48 * 0.25
            expect(dailyCosts[0]!.totalExportKwh).toBe(4.8); // 48 * 0.1
        });

        it('includes standing charge in daily totals', () => {
            const engine = new CostEngine(flatTariff);
            const intervals = [
                engine.calculateIntervalCost('2024-06-15T10:00:00Z', 1.0, 0),
            ];

            const dailyCosts = engine.aggregateDailyCosts(intervals);

            // Net cost should include standing charge
            const expectedNetCost = 24.5 - 0 + 47.43; // import - export + standing
            expect(dailyCosts[0]!.netCostPence).toBeCloseTo(expectedNetCost, 1);
        });

        it('handles multiple days correctly', () => {
            const engine = new CostEngine(flatTariff);
            const intervals = [
                engine.calculateIntervalCost('2024-06-15T10:00:00Z', 1.0, 0),
                engine.calculateIntervalCost('2024-06-15T12:00:00Z', 1.0, 0),
                engine.calculateIntervalCost('2024-06-16T10:00:00Z', 2.0, 0),
            ];

            const dailyCosts = engine.aggregateDailyCosts(intervals);

            expect(dailyCosts).toHaveLength(2);
            expect(dailyCosts[0]!.date).toBe('2024-06-15');
            expect(dailyCosts[0]!.totalImportKwh).toBe(2);
            expect(dailyCosts[1]!.date).toBe('2024-06-16');
            expect(dailyCosts[1]!.totalImportKwh).toBe(2);
        });
    });

    describe('UK_TARIFF_PRESETS', () => {
        it('has Octopus Flux as recommended', () => {
            expect(UK_TARIFF_PRESETS.octopusFlux.recommended).toBe(true);
        });

        it('all presets have required fields', () => {
            for (const [key, preset] of Object.entries(UK_TARIFF_PRESETS)) {
                expect(preset.displayLabel).toBeDefined();
                expect(preset.import.standardRatePence).toBeGreaterThan(0);
                expect(preset.import.standingChargePence).toBeGreaterThan(0);
                // 0 is valid - represents no export agreement in place (e.g. noExport preset)
                expect(preset.export.ratePence).toBeGreaterThanOrEqual(0);
                expect(preset.category).toBeDefined();
                expect(preset.eligibility).toBeDefined();
            }
        });

        it('Flux tariff has correct battery-optimized rates', () => {
            const flux = UK_TARIFF_PRESETS.octopusFlux;
            expect(flux.category).toBe('solar');
            expect(flux.import.offPeakRatePence).toBeDefined();
            expect(flux.import.offPeakRatePence).toBeLessThan(flux.import.standardRatePence);
        });

        it('EV tariffs have cheap overnight rates', () => {
            const intelligentGo = UK_TARIFF_PRESETS.intelligentGo;
            expect(intelligentGo.category).toBe('ev');
            expect(intelligentGo.import.offPeakRatePence).toBeDefined();
            expect(intelligentGo.import.offPeakRatePence!).toBeLessThan(10); // Very cheap overnight
        });
    });
});
