/**
 * Unit tests for Octopus Energy API client
 * Tests actual API connectivity with real credentials
 * 
 * Run with: npx tsx src/services/octopus-energy.test.ts
 */

import { OctopusEnergyClient } from './octopus-energy';

// API key should be provided as environment variable or directly for testing
const API_KEY = process.env.OCTOPUS_API_KEY || 'YOUR_API_KEY_HERE';
const BASE_URL = 'https://api.octopus.energy';

async function runTests() {
    console.log('=== Octopus Energy API Tests ===\n');

    if (API_KEY === 'YOUR_API_KEY_HERE') {
        console.error('❌ Please set OCTOPUS_API_KEY environment variable or replace YOUR_API_KEY_HERE');
        console.log('   Example: OCTOPUS_API_KEY=sk_live_xxx npx tsx src/services/octopus-energy.test.ts');
        process.exit(1);
    }

    // Pass baseURL explicitly to avoid import.meta.env.DEV issues in Node
    const client = new OctopusEnergyClient(API_KEY, BASE_URL);
    let accountNumber: string | undefined;
    let mpan: string | undefined;
    let serialNumber: string | undefined;

    // Test 1: Obtain Token
    console.log('Test 1: Obtain Kraken Token');
    try {
        const token = await client.obtainToken();
        console.log(`  ✅ Token obtained: ${token.substring(0, 20)}...`);
    } catch (error) {
        console.log(`  ❌ Failed: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
    }

    // Test 2: Discover Accounts
    console.log('\nTest 2: Discover Accounts');
    try {
        const discovery = await client.discoverAccounts();
        console.log(`  ✅ Found ${discovery.accounts.length} account(s)`);

        for (const account of discovery.accounts) {
            console.log(`     Account: ${account.number} (${account.status})`);
            accountNumber = account.number;
        }

        console.log(`  ✅ Found ${discovery.meters.length} meter(s)`);
        for (const meter of discovery.meters) {
            console.log(`     MPAN: ${meter.mpan}`);
            console.log(`     Serial: ${meter.serialNumber}`);
            console.log(`     Address: ${meter.address}`);
            console.log(`     Postcode: ${meter.postcode}`);
            mpan = meter.mpan;
            serialNumber = meter.serialNumber;
        }
    } catch (error) {
        console.log(`  ❌ Failed: ${error instanceof Error ? error.message : error}`);
    }

    // Test 3: Fetch Actual Tariff
    console.log('\nTest 3: Fetch Actual Tariff');
    if (accountNumber) {
        try {
            const tariffs = await client.fetchActualTariff(accountNumber);

            if (tariffs) {
                if (tariffs.import) {
                    console.log('  ✅ Import Tariff:');
                    console.log(`     Product: ${tariffs.import.productCode}`);
                    console.log(`     Tariff Code: ${tariffs.import.tariffCode}`);
                    console.log(`     Display Name: ${tariffs.import.displayName}`);
                    console.log(`     Full Name: ${tariffs.import.fullName || 'N/A'}`);
                    console.log(`     Unit Rate: ${tariffs.import.unitRatePence}p/kWh`);
                    console.log(`     Standing Charge: ${tariffs.import.standingChargePence}p/day`);
                    console.log(`     Valid From: ${tariffs.import.validFrom || 'N/A'}`);
                    console.log(`     Valid To: ${tariffs.import.validTo || 'Ongoing'}`);
                } else {
                    console.log('  ⚠️ No import tariff found');
                }

                if (tariffs.export) {
                    console.log('  ✅ Export Tariff:');
                    console.log(`     Product: ${tariffs.export.productCode}`);
                    console.log(`     Tariff Code: ${tariffs.export.tariffCode}`);
                    console.log(`     Display Name: ${tariffs.export.displayName}`);
                    console.log(`     Unit Rate: ${tariffs.export.unitRatePence}p/kWh`);
                } else {
                    console.log('  ℹ️ No export tariff (expected if no solar/battery)');
                }
            } else {
                console.log('  ❌ No tariff information returned');
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error instanceof Error ? error.message : error}`);
        }
    } else {
        console.log('  ⏭️ Skipped (no account number from previous test)');
    }

    // Test 4: Fetch Consumption Data (last 7 days)
    console.log('\nTest 4: Fetch Consumption Data (last 7 days)');
    if (mpan && serialNumber) {
        try {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            const consumption = await client.fetchConsumption({
                mpan,
                serialNumber,
                periodFrom: weekAgo.toISOString(),
                periodTo: now.toISOString(),
                apiKey: API_KEY,
            });

            console.log(`  ✅ Fetched ${consumption.records.length} consumption records`);
            console.log(`     MPAN: ${consumption.mpan}`);
            console.log(`     Period: ${consumption.periodStart} to ${consumption.periodEnd}`);

            if (consumption.records.length > 0) {
                const totalKwh = consumption.records.reduce((sum, r) => sum + r.consumption, 0);
                console.log(`     Total consumption: ${totalKwh.toFixed(2)} kWh`);
                console.log(`     First record: ${consumption.records[0].intervalStart}`);
                console.log(`     Last record: ${consumption.records[consumption.records.length - 1].intervalStart}`);
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error instanceof Error ? error.message : error}`);
        }
    } else {
        console.log('  ⏭️ Skipped (no meter details from previous test)');
    }

    // Test 5: Fetch Daily Consumption (last 30 days)
    console.log('\nTest 5: Fetch Daily Consumption (last 30 days)');
    if (mpan && serialNumber) {
        try {
            const now = new Date();
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            const daily = await client.fetchDailyConsumption({
                mpan,
                serialNumber,
                periodFrom: monthAgo.toISOString(),
                periodTo: now.toISOString(),
                apiKey: API_KEY,
            });

            console.log(`  ✅ Fetched ${daily.length} daily records`);

            if (daily.length > 0) {
                const totalKwh = daily.reduce((sum, d) => sum + d.consumptionKwh, 0);
                const avgDaily = totalKwh / daily.length;
                console.log(`     Total: ${totalKwh.toFixed(2)} kWh`);
                console.log(`     Daily average: ${avgDaily.toFixed(2)} kWh`);
                console.log(`     First day: ${daily[0].date} (${daily[0].consumptionKwh.toFixed(2)} kWh)`);
                console.log(`     Last day: ${daily[daily.length - 1].date} (${daily[daily.length - 1].consumptionKwh.toFixed(2)} kWh)`);
            }
        } catch (error) {
            console.log(`  ❌ Failed: ${error instanceof Error ? error.message : error}`);
        }
    } else {
        console.log('  ⏭️ Skipped (no meter details from previous test)');
    }

    console.log('\n=== Tests Complete ===');
}

// Run tests
runTests().catch(console.error);
