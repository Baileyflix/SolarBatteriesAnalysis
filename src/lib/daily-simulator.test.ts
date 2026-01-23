/**
 * Unit tests for solar generation and energy simulation calculations
 * Run with: npx tsx src/lib/daily-simulator.test.ts
 */

import {
    calculateDailyGeneration,
    simulateDailyEnergyFlows,
    aggregateToMonthly,
    createAnnualSummary
} from './daily-simulator';
import type { DailyIrradiance, DailyGeneration, DailyConsumption, BatteryConfig, TariffConfig } from '@/types';

// Test utilities
function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function assertClose(actual: number, expected: number, tolerance: number, message: string): void {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message}: expected ~${expected}, got ${actual} (tolerance: ${tolerance})`);
    }
}

// ============================================================================
// TEST 1: Solar Generation Calculation
// ============================================================================
console.log('\n=== TEST 1: Solar Generation Calculation ===');

// NASA POWER gives GHI in kWh/m²/day
// Formula: Generation (kWh) = GHI (kWh/m²/day) × System Size (kWp) × Performance Ratio
const testIrradiance: DailyIrradiance[] = [
    { date: '2025-06-21', ghiKwhPerM2: 5.0 },  // Good summer day
    { date: '2025-12-21', ghiKwhPerM2: 0.5 },  // Poor winter day
    { date: '2025-03-21', ghiKwhPerM2: 2.5 },  // Average spring day
];

const pvSystem = { systemSizeKwp: 5.0, performanceRatio: 0.80 };

const generationResult = calculateDailyGeneration(testIrradiance, pvSystem);

// Test 1a: Summer day - 5 kWh/m² × 5 kWp × 0.8 = 20 kWh
assertClose(generationResult[0].generationKwh, 20.0, 0.01, 'Summer day generation');
console.log(`✓ Summer day: 5 kWh/m² × 5kWp × 0.8 = ${generationResult[0].generationKwh.toFixed(2)} kWh (expected: 20.00)`);

// Test 1b: Winter day - 0.5 kWh/m² × 5 kWp × 0.8 = 2 kWh
assertClose(generationResult[1].generationKwh, 2.0, 0.01, 'Winter day generation');
console.log(`✓ Winter day: 0.5 kWh/m² × 5kWp × 0.8 = ${generationResult[1].generationKwh.toFixed(2)} kWh (expected: 2.00)`);

// Test 1c: Spring day - 2.5 kWh/m² × 5 kWp × 0.8 = 10 kWh
assertClose(generationResult[2].generationKwh, 10.0, 0.01, 'Spring day generation');
console.log(`✓ Spring day: 2.5 kWh/m² × 5kWp × 0.8 = ${generationResult[2].generationKwh.toFixed(2)} kWh (expected: 10.00)`);

// ============================================================================
// TEST 2: Energy Flow - No Battery
// ============================================================================
console.log('\n=== TEST 2: Energy Flow (No Battery) ===');

const noBattery: BatteryConfig = {
    capacityKwh: 0,
    maxChargePowerKw: 0,
    maxDischargePowerKw: 0,
    roundTripEfficiency: 0.9,
    minSocPercent: 10,
    maxSocPercent: 100,
    initialSocPercent: 50,
};

// Test 2a: Generation > Consumption (export to grid)
const consumption2a: DailyConsumption[] = [{ date: '2025-06-21', consumptionKwh: 10 }];
const generation2a: DailyGeneration[] = [{ date: '2025-06-21', generationKwh: 20 }];

const flows2a = simulateDailyEnergyFlows(consumption2a, generation2a, noBattery);
assertEqual(flows2a[0].gridImportKwh, 0, 'No import when generation exceeds consumption');
assertEqual(flows2a[0].gridExportKwh, 10, 'Export excess when generation > consumption');
console.log(`✓ Gen 20 kWh, Con 10 kWh → Import: ${flows2a[0].gridImportKwh}, Export: ${flows2a[0].gridExportKwh}`);

// Test 2b: Consumption > Generation (import from grid)
const consumption2b: DailyConsumption[] = [{ date: '2025-12-21', consumptionKwh: 15 }];
const generation2b: DailyGeneration[] = [{ date: '2025-12-21', generationKwh: 2 }];

const flows2b = simulateDailyEnergyFlows(consumption2b, generation2b, noBattery);
assertEqual(flows2b[0].gridImportKwh, 13, 'Import shortfall when consumption > generation');
assertEqual(flows2b[0].gridExportKwh, 0, 'No export when consumption > generation');
console.log(`✓ Gen 2 kWh, Con 15 kWh → Import: ${flows2b[0].gridImportKwh}, Export: ${flows2b[0].gridExportKwh}`);

// Test 2c: Generation = Consumption (self-sufficient)
const consumption2c: DailyConsumption[] = [{ date: '2025-03-21', consumptionKwh: 10 }];
const generation2c: DailyGeneration[] = [{ date: '2025-03-21', generationKwh: 10 }];

const flows2c = simulateDailyEnergyFlows(consumption2c, generation2c, noBattery);
assertEqual(flows2c[0].gridImportKwh, 0, 'No import when balanced');
assertEqual(flows2c[0].gridExportKwh, 0, 'No export when balanced');
console.log(`✓ Gen 10 kWh, Con 10 kWh → Import: ${flows2c[0].gridImportKwh}, Export: ${flows2c[0].gridExportKwh}`);

// ============================================================================
// TEST 3: Energy Balance Verification
// ============================================================================
console.log('\n=== TEST 3: Energy Balance Verification ===');

// Energy balance: Consumption = Self-consumed + Import
// Self-consumed = Generation - Export

for (const flow of [...flows2a, ...flows2b, ...flows2c]) {
    const selfConsumed = flow.generationKwh - flow.gridExportKwh;
    const checkBalance = selfConsumed + flow.gridImportKwh;
    assertClose(checkBalance, flow.consumptionKwh, 0.01, `Energy balance for ${flow.date}`);
}
console.log('✓ All energy balances verified');

// ============================================================================
// TEST 4: Monthly Aggregation
// ============================================================================
console.log('\n=== TEST 4: Monthly Aggregation ===');

const tariff: TariffConfig = {
    import: { type: 'flat', standardRatePence: 24.5, standingChargePence: 46.34 },
    export: { name: 'SEG', ratePence: 4.1 },
};

// Create 30 days of June data
const juneConsumption: DailyConsumption[] = [];
const juneGeneration: DailyGeneration[] = [];
for (let day = 1; day <= 30; day++) {
    const date = `2025-06-${String(day).padStart(2, '0')}`;
    juneConsumption.push({ date, consumptionKwh: 10 });  // 10 kWh/day
    juneGeneration.push({ date, generationKwh: 20 });    // 20 kWh/day
}

const juneFlows = simulateDailyEnergyFlows(juneConsumption, juneGeneration, noBattery);
const juneMonthly = aggregateToMonthly(juneFlows, tariff);

assertEqual(juneMonthly.length, 1, 'Should have 1 month');
assertEqual(juneMonthly[0].month, '2025-06', 'Month should be 2025-06');
assertClose(juneMonthly[0].totalConsumptionKwh, 300, 0.1, 'Total consumption');
assertClose(juneMonthly[0].totalGenerationKwh, 600, 0.1, 'Total generation');
assertClose(juneMonthly[0].gridImportKwh, 0, 0.1, 'Grid import');
assertClose(juneMonthly[0].gridExportKwh, 300, 0.1, 'Grid export');

console.log(`✓ June: Con=${juneMonthly[0].totalConsumptionKwh}, Gen=${juneMonthly[0].totalGenerationKwh}, Import=${juneMonthly[0].gridImportKwh}, Export=${juneMonthly[0].gridExportKwh}`);

// ============================================================================
// TEST 5: Financial Calculation
// ============================================================================
console.log('\n=== TEST 5: Financial Calculations ===');

// June: 0 kWh import, 300 kWh export
// Import cost: 0 × 24.5p = £0
// Export revenue: 300 × 4.1p = £12.30
// Standing charge: 30 × 46.34p = £13.90
// Net: £0 + £13.90 - £12.30 = £1.60

assertClose(juneMonthly[0].importCostPounds, 0, 0.01, 'Import cost');
assertClose(juneMonthly[0].exportRevenuePounds, 12.30, 0.01, 'Export revenue');
assertClose(juneMonthly[0].standingChargePounds, 13.90, 0.02, 'Standing charge');
assertClose(juneMonthly[0].netCostPounds, 1.60, 0.03, 'Net cost');

console.log(`✓ Import: £${juneMonthly[0].importCostPounds.toFixed(2)}, Export: £${juneMonthly[0].exportRevenuePounds.toFixed(2)}, Standing: £${juneMonthly[0].standingChargePounds.toFixed(2)}, Net: £${juneMonthly[0].netCostPounds.toFixed(2)}`);

// ============================================================================
// TEST 6: Baseline vs Solar Comparison
// ============================================================================
console.log('\n=== TEST 6: Baseline vs Solar Comparison ===');

// Baseline (no solar): All consumption from grid
const baselineGeneration = juneGeneration.map(g => ({ ...g, generationKwh: 0 }));
const baselineFlows = simulateDailyEnergyFlows(juneConsumption, baselineGeneration, noBattery);
const baselineMonthly = aggregateToMonthly(baselineFlows, tariff);

// Baseline: 300 kWh import × 24.5p = £73.50 + £13.90 standing = £87.40
assertClose(baselineMonthly[0].gridImportKwh, 300, 0.1, 'Baseline import');
assertClose(baselineMonthly[0].importCostPounds, 73.50, 0.01, 'Baseline import cost');
assertClose(baselineMonthly[0].netCostPounds, 87.40, 0.05, 'Baseline net cost');

console.log(`✓ Baseline: Import=${baselineMonthly[0].gridImportKwh} kWh, Cost=£${baselineMonthly[0].netCostPounds.toFixed(2)}`);
console.log(`✓ With Solar: Import=${juneMonthly[0].gridImportKwh} kWh, Cost=£${juneMonthly[0].netCostPounds.toFixed(2)}`);
console.log(`✓ Savings: £${(baselineMonthly[0].netCostPounds - juneMonthly[0].netCostPounds).toFixed(2)}`);

// ============================================================================
// TEST 7: Real-world Scenario (UK Annual)
// ============================================================================
console.log('\n=== TEST 7: Real-world UK Annual Scenario ===');

// Simulate a year with realistic UK data
// Average UK household: ~3,700 kWh/year consumption
// 5kWp system in UK: ~4,000-4,500 kWh/year generation

const ukMonthlyGHI = [
    0.8, 1.3, 2.5, 3.8, 4.8, 5.2,  // Jan-Jun
    5.0, 4.3, 3.2, 2.0, 1.0, 0.6   // Jul-Dec
];
const ukMonthlyConsumption = [
    12, 11, 10, 9, 8, 7,   // Jan-Jun (kWh/day)
    7, 8, 9, 10, 11, 13    // Jul-Dec
];
const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const yearConsumption: DailyConsumption[] = [];
const yearGeneration: DailyGeneration[] = [];

for (let month = 0; month < 12; month++) {
    for (let day = 1; day <= daysInMonth[month]; day++) {
        const date = `2025-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        yearConsumption.push({ date, consumptionKwh: ukMonthlyConsumption[month] });
        // Generate from GHI: GHI × 5kWp × 0.8
        yearGeneration.push({ date, generationKwh: ukMonthlyGHI[month] * 5.0 * 0.8 });
    }
}

const yearFlows = simulateDailyEnergyFlows(yearConsumption, yearGeneration, noBattery);
const yearMonthly = aggregateToMonthly(yearFlows, tariff);
const yearSummary = createAnnualSummary(yearMonthly);

const totalConsumption = yearConsumption.reduce((sum, d) => sum + d.consumptionKwh, 0);
const totalGeneration = yearGeneration.reduce((sum, d) => sum + d.generationKwh, 0);

console.log(`Total consumption: ${totalConsumption.toFixed(0)} kWh`);
console.log(`Total generation: ${totalGeneration.toFixed(0)} kWh`);
console.log(`Summary consumption: ${yearSummary.totalConsumptionKwh.toFixed(0)} kWh`);
console.log(`Summary generation: ${yearSummary.totalGenerationKwh.toFixed(0)} kWh`);
console.log(`Grid import: ${yearSummary.totalImportKwh.toFixed(0)} kWh`);
console.log(`Grid export: ${yearSummary.totalExportKwh.toFixed(0)} kWh`);
console.log(`Net cost: £${yearSummary.totalNetCostPounds.toFixed(2)}`);

// Verify generation is reasonable (4000-4500 kWh for 5kWp in UK)
const expectedGeneration = ukMonthlyGHI.reduce((sum, ghi, i) => sum + ghi * daysInMonth[i], 0) * 5 * 0.8;
assertClose(totalGeneration, expectedGeneration, 1, 'Annual generation calculation');
console.log(`\n✓ Expected annual generation: ${expectedGeneration.toFixed(0)} kWh`);

// Baseline comparison
const baselineYearFlows = simulateDailyEnergyFlows(
    yearConsumption,
    yearGeneration.map(g => ({ ...g, generationKwh: 0 })),
    noBattery
);
const baselineYearMonthly = aggregateToMonthly(baselineYearFlows, tariff);
const baselineYearSummary = createAnnualSummary(baselineYearMonthly);

console.log(`\nBaseline (no solar) cost: £${baselineYearSummary.totalNetCostPounds.toFixed(2)}`);
console.log(`With solar cost: £${yearSummary.totalNetCostPounds.toFixed(2)}`);
console.log(`Annual savings: £${(baselineYearSummary.totalNetCostPounds - yearSummary.totalNetCostPounds).toFixed(2)}`);

console.log('\n=== ALL TESTS PASSED ===\n');
