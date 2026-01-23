import type {
    TariffConfig,
    MonthlyFinancialSummary,
    AnnualFinancialSummary,
    BatteryConfig,
    DailyConsumption,
} from '@/types';
import type { DailyEnergyRecord, DailyIrradiance, DailyGeneration } from '@/types/daily';

/**
 * PV system configuration
 */
export interface PVSystemConfig {
    systemSizeKwp: number;
    performanceRatio: number;
}

/**
 * Calculate daily PV generation from irradiance
 * 
 * Formula: Generation (kWh) = GHI (kWh/m²/day) × System Size (kWp) × Performance Ratio
 * 
 * This is the standard calculation:
 * - NASA POWER gives irradiance in kWh/m²/day
 * - A 1kWp panel produces 1kWh per kWh/m² of irradiance under STC (1kW/m² = 1kWh/m²/hour)
 * - Performance ratio accounts for real-world losses (temperature, wiring, inverter, etc.)
 * 
 * Example: 5 kWh/m²/day × 5 kWp × 0.80 = 20 kWh/day
 */
export function calculateDailyGeneration(
    irradiance: DailyIrradiance[],
    pvSystem: PVSystemConfig
): DailyGeneration[] {
    return irradiance.map((day) => ({
        date: day.date,
        generationKwh: day.ghiKwhPerM2 * pvSystem.systemSizeKwp * pvSystem.performanceRatio,
    }));
}

/**
 * Battery arbitrage strategy for time-of-use tariffs
 * 
 * When tariff has off-peak rates (e.g., Octopus Flux, Intelligent Go):
 * 1. Overnight (off-peak): Charge battery from grid at cheap rate
 * 2. Day: Use solar + battery, minimize grid import
 * 3. Peak (16:00-19:00): Export stored energy at premium rate
 * 
 * This calculates the economic benefit of:
 * - Charging at off-peak rate (10p) instead of day rate (24p)
 * - Exporting at peak rate (25p) when battery has stored cheap energy
 */
export interface ArbitrageResult {
    /** kWh charged from grid overnight at off-peak rate */
    overnightChargeKwh: number;
    /** kWh exported during peak hours (16:00-19:00) */
    peakExportKwh: number;
    /** Estimated savings from arbitrage (buying cheap, selling expensive) */
    arbitrageSavingsPence: number;
}

/**
 * Simulate daily energy flows with optional battery and arbitrage strategy
 * 
 * Energy balance per day (ENHANCED with battery arbitrage):
 * 
 * 1. OVERNIGHT (Off-peak 02:00-05:00 or 23:30-05:30):
 *    - If tariff has cheap off-peak rate, charge battery from grid
 *    - This costs offPeakRate per kWh (e.g., 7-10p)
 * 
 * 2. DAYTIME:
 *    - Self-consumed = min(generation, consumption)
 *    - Excess PV charges battery (up to capacity)
 *    - Shortfall met by battery, then grid import
 * 
 * 3. PEAK (16:00-19:00):
 *    - If tariff has high export rate, discharge battery to grid
 *    - Earns exportRate per kWh (e.g., 25p with Flux)
 * 
 * Without battery (capacity = 0):
 * - All excess → grid export
 * - All shortfall → grid import
 * 
 * The financial benefit of arbitrage = (exportRate - offPeakRate) × exportedKwh
 * e.g., Flux: (25p - 10p) × 5kWh = 75p per day = £22.50/month potential
 */
export function simulateDailyEnergyFlows(
    consumption: DailyConsumption[],
    generation: DailyGeneration[],
    battery: BatteryConfig,
    tariff?: TariffConfig
): DailyEnergyRecord[] {
    // Create a map of generation by date
    const genMap = new Map(generation.map((g) => [g.date, g.generationKwh]));

    // Battery state (simplified daily model)
    let batteryStoredKwh = (battery.initialSocPercent ?? 50) / 100 * battery.capacityKwh;
    const minBatteryKwh = (battery.minSocPercent ?? 10) / 100 * battery.capacityKwh;
    const maxBatteryKwh = (battery.maxSocPercent ?? 100) / 100 * battery.capacityKwh;
    const efficiency = Math.sqrt(battery.roundTripEfficiency); // Split efficiency between charge/discharge

    const noBattery = battery.capacityKwh === 0;

    // Check if tariff supports arbitrage (has cheap off-peak and good export)
    const hasArbitrageOpportunity = tariff &&
        tariff.import.offPeakRatePence !== undefined &&
        tariff.export.ratePence >= 15; // Worth it if export >= 15p

    return consumption.map((day) => {
        const gen = genMap.get(day.date) ?? 0;
        const con = day.consumptionKwh;

        // Calculate net position
        const selfConsumed = Math.min(gen, con);
        let excess = gen - selfConsumed;
        let shortfall = con - selfConsumed;

        let gridImport = 0;
        let gridExport = 0;
        let overnightChargeKwh = 0;
        let peakExportKwh = 0;

        if (noBattery) {
            // No battery: direct to/from grid
            gridExport = excess;
            gridImport = shortfall;
        } else {
            // WITH BATTERY - Enhanced with arbitrage strategy

            // STEP 1: OVERNIGHT GRID CHARGING (if tariff supports it)
            // Charge battery from grid during off-peak hours (cheap rate)
            if (hasArbitrageOpportunity) {
                const roomInBattery = maxBatteryKwh - batteryStoredKwh;
                // Charge overnight - typically 3-6 hours, limit to battery capacity
                // Assume we can charge up to 80% of remaining capacity overnight
                const overnightCharge = Math.min(roomInBattery * 0.8, battery.maxChargePowerKw * 5);
                const actualCharge = overnightCharge * efficiency;
                batteryStoredKwh += actualCharge;
                overnightChargeKwh = overnightCharge;
                gridImport += overnightCharge; // This is charged at off-peak rate
            }

            // STEP 2: DAYTIME SOLAR HANDLING
            if (excess > 0) {
                // Charge battery with excess solar
                const roomInBattery = maxBatteryKwh - batteryStoredKwh;
                const canCharge = Math.min(excess * efficiency, roomInBattery);
                batteryStoredKwh += canCharge;
                const excessUsedForCharging = canCharge / efficiency;
                excess -= excessUsedForCharging;
                // Don't export during day - save for peak (if arbitrage)
                if (!hasArbitrageOpportunity) {
                    gridExport = excess;
                }
            }

            if (shortfall > 0) {
                // Discharge battery to meet shortfall
                const availableFromBattery = (batteryStoredKwh - minBatteryKwh) * efficiency;
                const canDischarge = Math.min(shortfall, availableFromBattery);
                batteryStoredKwh -= canDischarge / efficiency;
                gridImport += shortfall - canDischarge;
            }

            // STEP 3: PEAK EXPORT (16:00-19:00) - Discharge battery for revenue
            if (hasArbitrageOpportunity) {
                // Export battery contents during peak hours (3 hours)
                const availableForExport = (batteryStoredKwh - minBatteryKwh) * efficiency;
                // Limit by max discharge power × peak hours (3hrs)
                const maxPeakExport = Math.min(availableForExport, battery.maxDischargePowerKw * 3);
                peakExportKwh = maxPeakExport;
                batteryStoredKwh -= maxPeakExport / efficiency;
                gridExport += peakExportKwh;
            }

            // Add any remaining excess as export
            if (excess > 0) {
                gridExport += excess;
            }
        }

        return {
            date: day.date,
            consumptionKwh: Math.round(con * 100) / 100,
            generationKwh: Math.round(gen * 100) / 100,
            gridImportKwh: Math.round(gridImport * 100) / 100,
            gridExportKwh: Math.round(gridExport * 100) / 100,
            // Track arbitrage for cost calculation
            overnightChargeKwh: Math.round(overnightChargeKwh * 100) / 100,
            peakExportKwh: Math.round(peakExportKwh * 100) / 100,
        };
    });
}

/**
 * Aggregate daily records into monthly summaries
 * 
 * ENHANCED: Handles time-of-use tariff pricing for battery arbitrage:
 * - Overnight charging is billed at off-peak rate (if available)
 * - Regular imports are billed at standard rate
 * - Peak exports earn higher export rate
 */
export function aggregateToMonthly(
    dailyRecords: DailyEnergyRecord[],
    tariff: TariffConfig
): MonthlyFinancialSummary[] {
    // Group by year-month
    const monthlyMap = new Map<string, DailyEnergyRecord[]>();

    for (const record of dailyRecords) {
        const [year, month] = record.date.split('-');
        const yearMonth = `${year}-${month}`;
        const existing = monthlyMap.get(yearMonth) ?? [];
        existing.push(record);
        monthlyMap.set(yearMonth, existing);
    }

    const summaries: MonthlyFinancialSummary[] = [];

    // Check for time-of-use rates
    const offPeakRate = tariff.import.offPeakRatePence ?? tariff.import.standardRatePence;
    const standardRate = tariff.import.standardRatePence;
    const exportRate = tariff.export.ratePence;

    for (const [month, days] of monthlyMap.entries()) {
        const totalConsumption = days.reduce((sum, d) => sum + d.consumptionKwh, 0);
        const totalGeneration = days.reduce((sum, d) => sum + d.generationKwh, 0);
        const totalImport = days.reduce((sum, d) => sum + d.gridImportKwh, 0);
        const totalExport = days.reduce((sum, d) => sum + d.gridExportKwh, 0);

        // Calculate arbitrage components (if present in records)
        const totalOvernightCharge = days.reduce((sum, d) => sum + (d.overnightChargeKwh ?? 0), 0);
        const totalPeakExport = days.reduce((sum, d) => sum + (d.peakExportKwh ?? 0), 0);

        // Regular import = total import - overnight charging (which is at off-peak rate)
        const regularImport = totalImport - totalOvernightCharge;

        // Cost calculation with time-of-use rates:
        // - Overnight charging at off-peak rate
        // - Regular imports at standard rate
        const overnightCostPounds = (totalOvernightCharge * offPeakRate) / 100;
        const regularImportCostPounds = (regularImport * standardRate) / 100;
        const importCostPounds = overnightCostPounds + regularImportCostPounds;

        const exportRevenuePounds = (totalExport * exportRate) / 100;
        const standingChargePounds = (days.length * tariff.import.standingChargePence) / 100;
        const netCostPounds = importCostPounds + standingChargePounds - exportRevenuePounds;

        // Calculate arbitrage savings (difference between off-peak and standard rate)
        const arbitrageSavingsPounds = (totalOvernightCharge * (standardRate - offPeakRate)) / 100;

        summaries.push({
            month,
            daysInMonth: days.length,
            totalConsumptionKwh: Math.round(totalConsumption * 10) / 10,
            totalGenerationKwh: Math.round(totalGeneration * 10) / 10,
            gridImportKwh: Math.round(totalImport * 10) / 10,
            gridExportKwh: Math.round(totalExport * 10) / 10,
            importCostPounds: Math.round(importCostPounds * 100) / 100,
            exportRevenuePounds: Math.round(exportRevenuePounds * 100) / 100,
            standingChargePounds: Math.round(standingChargePounds * 100) / 100,
            netCostPounds: Math.round(netCostPounds * 100) / 100,
            // Additional arbitrage metrics
            overnightChargeKwh: Math.round(totalOvernightCharge * 10) / 10,
            peakExportKwh: Math.round(totalPeakExport * 10) / 10,
            arbitrageSavingsPounds: Math.round(arbitrageSavingsPounds * 100) / 100,
        });
    }

    // Sort by month
    summaries.sort((a, b) => a.month.localeCompare(b.month));

    return summaries;
}

/**
 * Create annual summary from monthly data
 */
export function createAnnualSummary(
    monthlyBreakdown: MonthlyFinancialSummary[]
): AnnualFinancialSummary {
    const year = monthlyBreakdown[0]?.month.split('-')[0] ?? new Date().getFullYear().toString();

    return {
        year,
        totalConsumptionKwh: Math.round(monthlyBreakdown.reduce((sum, m) => sum + m.totalConsumptionKwh, 0) * 10) / 10,
        totalGenerationKwh: Math.round(monthlyBreakdown.reduce((sum, m) => sum + m.totalGenerationKwh, 0) * 10) / 10,
        totalImportKwh: Math.round(monthlyBreakdown.reduce((sum, m) => sum + m.gridImportKwh, 0) * 10) / 10,
        totalExportKwh: Math.round(monthlyBreakdown.reduce((sum, m) => sum + m.gridExportKwh, 0) * 10) / 10,
        totalImportCostPounds: Math.round(monthlyBreakdown.reduce((sum, m) => sum + m.importCostPounds, 0) * 100) / 100,
        totalExportRevenuePounds: Math.round(monthlyBreakdown.reduce((sum, m) => sum + m.exportRevenuePounds, 0) * 100) / 100,
        totalStandingChargePounds: Math.round(monthlyBreakdown.reduce((sum, m) => sum + m.standingChargePounds, 0) * 100) / 100,
        totalNetCostPounds: Math.round(monthlyBreakdown.reduce((sum, m) => sum + m.netCostPounds, 0) * 100) / 100,
        monthlyBreakdown,
    };
}
