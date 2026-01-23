/**
 * Test solar-data.ts distribution function
 * Run with: npx tsx src/services/solar-data.test.ts
 */

import { SolarDataClient } from './solar-data';
import { SolarGenerator } from '../lib/solar-generator';

console.log('\n=== TEST: Solar Data Distribution ===\n');

// Create the client and access the private method via a workaround
// We'll create a minimal test by directly testing the logic

const dailyGHI = 5.0; // kWh/m²/day (typical UK summer day)
const daylightHours = 16; // hours

// Replicate the distribution logic from solar-data.ts
function distributeDailyGHI(dailyGHIkWhPerM2: number, daylightHrs: number) {
    const sunriseHour = 12 - daylightHrs / 2;
    const sunsetHour = 12 + daylightHrs / 2;
    const totalWhPerM2 = dailyGHIkWhPerM2 * 1000;

    const records = [];

    for (let period = 0; period < 48; period++) {
        const hour = Math.floor(period / 2);
        const minute = (period % 2) * 30;
        const decimalHour = hour + minute / 60;

        let ghi = 0;

        if (decimalHour >= sunriseHour && decimalHour <= sunsetHour) {
            // From solar-data.ts:
            const hourAngle = ((decimalHour - 12) / (daylightHrs / 2)) * Math.PI;
            const solarIntensityFactor = Math.max(0, Math.cos(hourAngle));
            const peakGHI = (totalWhPerM2 * Math.PI) / (daylightHrs * 2);
            ghi = peakGHI * solarIntensityFactor;
        }

        records.push({ period, hour: decimalHour, ghi });
    }

    return records;
}

const distributed = distributeDailyGHI(dailyGHI, daylightHours);

// Calculate the total when treated as W/m² for 30 minutes each
// Each period: ghi (W/m²) × 0.5 hours = Wh/m²
const totalWh = distributed.reduce((sum, r) => sum + r.ghi * 0.5, 0);
const totalKwh = totalWh / 1000;

console.log(`Input: ${dailyGHI} kWh/m²/day`);
console.log(`Daylight hours: ${daylightHours}`);
console.log('');

console.log('Distribution results:');
const peakRecord = distributed.reduce((max, r) => r.ghi > max.ghi ? r : max, distributed[0]);
console.log(`  Peak GHI: ${peakRecord.ghi.toFixed(0)} W/m² at ${peakRecord.hour}:00`);
console.log(`  Sum of (GHI × 0.5h): ${totalWh.toFixed(0)} Wh/m² = ${totalKwh.toFixed(2)} kWh/m²`);
console.log('');

if (Math.abs(totalKwh - dailyGHI) < 0.1) {
    console.log(`✓ Distribution preserves total energy (${totalKwh.toFixed(2)} ≈ ${dailyGHI})`);
} else {
    console.log(`✗ Distribution LOSES energy!`);
    console.log(`  Expected: ${dailyGHI} kWh/m²`);
    console.log(`  Got: ${totalKwh.toFixed(2)} kWh/m²`);
    console.log(`  Lost: ${(dailyGHI - totalKwh).toFixed(2)} kWh/m² (${((dailyGHI - totalKwh) / dailyGHI * 100).toFixed(1)}%)`);
}

console.log('');
console.log('Sample periods around noon:');
for (let i = 20; i <= 28; i++) {
    const r = distributed[i];
    console.log(`  ${r.hour.toFixed(1)}h: ${r.ghi.toFixed(0)} W/m²`);
}

// Now test the full pipeline
console.log('\n=== Full Pipeline Test ===\n');

// Expected: 5 kWh/m² × 5 kWp × 0.8 PR = 20 kWh
const expectedGeneration = dailyGHI * 5 * 0.8;

// What solar-generator.ts produces from the distributed data:
// Each period: (ghi / 1000) × 5 × 0.8 × 0.5
const actualGeneration = distributed.reduce((sum, r) => {
    return sum + (r.ghi / 1000) * 5 * 0.8 * 0.5;
}, 0);

console.log(`Expected daily generation: ${expectedGeneration.toFixed(2)} kWh`);
console.log(`Actual daily generation: ${actualGeneration.toFixed(2)} kWh`);

if (Math.abs(actualGeneration - expectedGeneration) < 0.1) {
    console.log(`✓ Pipeline produces correct generation`);
} else {
    console.log(`✗ Pipeline ERROR`);
    console.log(`  Discrepancy: ${(expectedGeneration - actualGeneration).toFixed(2)} kWh`);
}
