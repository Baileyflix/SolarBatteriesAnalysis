/**
 * Test to verify half-hourly generation data is correctly generated
 * Run with: npx tsx src/lib/solar-generator.test.ts
 */

import { SolarGenerator } from './solar-generator';
import type { IrradianceRecord, PVSystemConfig } from '@/types';

console.log('\n=== TEST: Solar Generator (Half-hourly) ===\n');

// Create a test day with known irradiance values
// Simulating a clear summer day with ~5 kWh/m²/day total

const pvConfig: PVSystemConfig = {
    systemSizeKwp: 5.0,
    performanceRatio: 0.80,
};

const generator = new SolarGenerator(pvConfig);

// Create synthetic irradiance data for one day
// Peak irradiance around noon of ~800 W/m², distributed over ~12 hours
const testDate = new Date('2025-06-21');
const irradianceRecords: IrradianceRecord[] = [];

// Create 48 half-hourly periods
for (let period = 0; period < 48; period++) {
    const hour = Math.floor(period / 2);
    const minute = (period % 2) * 30;

    const intervalStart = new Date(testDate);
    intervalStart.setHours(hour, minute, 0, 0);

    const intervalEnd = new Date(intervalStart);
    intervalEnd.setMinutes(intervalEnd.getMinutes() + 30);

    // Simple sinusoidal irradiance pattern: peaks at noon (12:00)
    // GHI in W/m² - sunrise ~5am, sunset ~9pm in summer UK
    let ghi = 0;
    const decimalHour = hour + minute / 60;

    if (decimalHour >= 5 && decimalHour <= 21) {
        // Peak at noon of ~800 W/m²
        const solarPosition = Math.cos((decimalHour - 12) / 8 * Math.PI);
        ghi = Math.max(0, 800 * solarPosition);
    }

    irradianceRecords.push({
        intervalStart: intervalStart.toISOString(),
        intervalEnd: intervalEnd.toISOString(),
        ghi,
    });
}

// Generate the time series
const timeSeries = generator.generateTimeSeries(irradianceRecords, 'Test Location');

// Calculate totals
const totalGeneration = timeSeries.records.reduce((sum, r) => sum + r.generation, 0);
const totalIrradiance = irradianceRecords.reduce((sum, r) => sum + r.ghi, 0);

console.log('Test Configuration:');
console.log(`  System size: ${pvConfig.systemSizeKwp} kWp`);
console.log(`  Performance ratio: ${pvConfig.performanceRatio}`);
console.log(`  Number of records: ${timeSeries.records.length}`);
console.log('');

console.log('Irradiance Summary:');
console.log(`  Total GHI (sum of W/m²): ${totalIrradiance.toFixed(0)}`);
// Each 30-min period at X W/m² = X × 0.5 hours = X/2 Wh/m² = X/2000 kWh/m²
const totalIrradianceKwhPerM2 = irradianceRecords.reduce((sum, r) => sum + r.ghi * 0.5 / 1000, 0);
console.log(`  Total GHI (kWh/m²/day): ${totalIrradianceKwhPerM2.toFixed(2)}`);
console.log('');

console.log('Generation Summary:');
console.log(`  Total generation: ${totalGeneration.toFixed(2)} kWh`);
console.log('');

// Expected: GHI (kWh/m²) × kWp × PR
const expectedGeneration = totalIrradianceKwhPerM2 * pvConfig.systemSizeKwp * pvConfig.performanceRatio;
console.log(`Expected generation: ${expectedGeneration.toFixed(2)} kWh`);
console.log(`  Formula: ${totalIrradianceKwhPerM2.toFixed(2)} kWh/m² × ${pvConfig.systemSizeKwp} kWp × ${pvConfig.performanceRatio}`);
console.log('');

// Check the calculation method in solar-generator.ts
console.log('Verifying solar-generator.ts calculation:');
console.log('  Formula used: GHI (W/m²) / 1000 × kWp × PR × 0.5 hours');
console.log(`  For 800 W/m² interval: ${800} / 1000 × ${pvConfig.systemSizeKwp} × ${pvConfig.performanceRatio} × 0.5 = ${800 / 1000 * 5 * 0.8 * 0.5} kWh`);
console.log('');

// Show sample of records around noon
console.log('Sample records around noon (periods 22-26):');
for (let i = 22; i <= 26; i++) {
    const record = timeSeries.records[i];
    const irr = irradianceRecords[i];
    console.log(`  ${record.intervalStart.slice(11, 16)}: GHI=${irr.ghi.toFixed(0)} W/m² → Gen=${record.generation.toFixed(3)} kWh`);
}
console.log('');

// Verify the relationship
const discrepancy = Math.abs(totalGeneration - expectedGeneration);
if (discrepancy < 0.1) {
    console.log(`✓ Generation matches expected (discrepancy: ${discrepancy.toFixed(4)} kWh)`);
} else {
    console.log(`✗ Generation does NOT match expected!`);
    console.log(`  Discrepancy: ${discrepancy.toFixed(2)} kWh (${(discrepancy / expectedGeneration * 100).toFixed(1)}%)`);
}

console.log('\n=== Checking solar-data.ts distribution ===\n');

// Now let's verify what solar-data.ts produces
// It takes daily GHI (kWh/m²/day) and distributes across 48 periods

// The distributeDailyGHI function should produce irradiance that integrates back to the original daily total
// Let's verify the math

const dailyGHI = 5.0; // kWh/m²/day
const daylightHours = 16; // hours of daylight in summer
const totalWhPerM2 = dailyGHI * 1000; // Convert to Wh/m²

// peakGHI = (totalWhPerM2 * π) / (daylightHours * 2)
const peakGHI = (totalWhPerM2 * Math.PI) / (daylightHours * 2);
console.log(`Daily GHI: ${dailyGHI} kWh/m²/day`);
console.log(`Peak GHI (from formula): ${peakGHI.toFixed(0)} W/m²`);

// Integral of cos(x) from -π/2 to π/2 = 2
// So total energy = peakGHI × daylightHours × 2/π = peakGHI × daylightHours × 0.637
const integratedTotal = peakGHI * daylightHours * (2 / Math.PI);
console.log(`Integrated total: ${integratedTotal.toFixed(0)} Wh/m² = ${(integratedTotal / 1000).toFixed(2)} kWh/m²`);
console.log('');

// The solar-generator then uses:
// generation = (ghi / 1000) × kWp × PR × 0.5
// For each period with GHI in W/m²

// Expected total: dailyGHI × kWp × PR
const expectedFromDaily = dailyGHI * 5 * 0.8;
console.log(`Expected daily generation: ${dailyGHI} × 5 kWp × 0.8 = ${expectedFromDaily.toFixed(2)} kWh`);
