import type {
    TariffConfig,
    MonthlyFinancialSummary,
    AnnualFinancialSummary,
    BatteryConfig,
    DailyConsumption,
} from '@/types';
import type { DailyEnergyRecord, DailyCostBreakdown, DailyIrradiance, DailyGeneration } from '@/types/daily';

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
 *    - Happens regardless of export price - worthwhile purely to offset
 *      expensive daytime self-consumption, even with no export deal at all
 *
 * 2. DAYTIME:
 *    - Self-consumed = min(generation, consumption)
 *    - Excess PV charges battery (up to capacity)
 *    - Shortfall met by battery, then grid import
 *
 * 3. PEAK (16:00-19:00):
 *    - Only if export rate is worthwhile (>=15p): discharge battery to grid
 *    - Earns exportRate per kWh (e.g., 25p with Flux)
 *    - If export isn't worthwhile, charge is simply carried over/self-consumed instead
 * 
 * Without battery (capacity = 0):
 * - All excess → grid export
 * - All shortfall → grid import
 * 
 * The financial benefit of arbitrage = (exportRate - offPeakRate) × exportedKwh
 * e.g., Flux: (25p - 10p) × 5kWh = 75p per day = £22.50/month potential
 *
 * KNOWN LIMITATION (not yet fixed): this whole model works on daily totals only -
 * it has no visibility into *when within the day* consumption happens. That means:
 *   1. The overnight-charge amount doesn't subtract concurrent house load during
 *      the off-peak window (minor in practice - charger power usually dwarfs it).
 *   2. More importantly: any house consumption that happens directly from the grid
 *      during the off-peak window (not routed through the battery) is NOT billed
 *      at the off-peak rate - it's lumped into the day's regular-rate import. Real
 *      Octopus Go/Flux/etc. billing would charge that usage at the cheap rate
 *      regardless of the battery. This means the model understates real savings
 *      on off-peak tariffs. A proper fix needs the actual half-hourly consumption
 *      data (already fetched from Octopus, just not used at this aggregation step)
 *      to determine what fraction of each day's usage genuinely falls in the
 *      off-peak window, and bill that portion cheaply independent of the battery.
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

    // These are independent decisions: a tariff can be worth charging off-peak
    // for even with no (or poor) export rate - e.g. shifting cheap overnight
    // energy to offset expensive daytime import, with nothing ever sold back.
    const canChargeOffPeak = tariff !== undefined && tariff.import.offPeakRatePence !== undefined;
    const canExportAtPeak = tariff !== undefined && tariff.export.ratePence >= 15; // Only worth holding back for peak export if the rate is decent

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

            // STEP 1: OVERNIGHT GRID CHARGING (if tariff has a cheap off-peak rate)
            // Charge battery from grid during off-peak hours, regardless of export price -
            // this is worthwhile purely to offset expensive daytime self-consumption.
            if (canChargeOffPeak) {
                const roomInBattery = maxBatteryKwh - batteryStoredKwh;
                // Fill however much room is available, limited only by charge power over
                // a representative off-peak window (~5 hours - most UK off-peak windows
                // are 3-6 hours). A well-sized battery should reach full capacity most nights.
                const overnightCharge = Math.min(roomInBattery, battery.maxChargePowerKw * 5);
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
                // Don't export during day - save for peak (only worth holding back if peak export pays)
                if (!canExportAtPeak) {
                    gridExport = excess;
                    excess = 0; // already accounted for above - avoid double-counting below
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
            if (canExportAtPeak) {
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
 * Break each day down into off-peak battery-charging cost vs. regular-rate
 * import cost, so a UI can drill into a single day's bill rather than only
 * seeing the monthly total. Uses the exact same rate logic as aggregateToMonthly.
 */
export function aggregateToDaily(
    dailyRecords: DailyEnergyRecord[],
    tariff: TariffConfig
): DailyCostBreakdown[] {
    const offPeakRate = tariff.import.offPeakRatePence ?? tariff.import.standardRatePence;
    const standardRate = tariff.import.standardRatePence;
    const exportRate = tariff.export.ratePence;
    const standingChargePounds = tariff.import.standingChargePence / 100;

    return dailyRecords.map((day) => {
        const offPeakChargeKwh = day.overnightChargeKwh ?? 0;
        const regularImportKwh = day.gridImportKwh - offPeakChargeKwh;

        const offPeakChargeCostPounds = (offPeakChargeKwh * offPeakRate) / 100;
        const regularImportCostPounds = (regularImportKwh * standardRate) / 100;
        const totalImportCostPounds = offPeakChargeCostPounds + regularImportCostPounds;

        const exportRevenuePounds = (day.gridExportKwh * exportRate) / 100;
        const netCostPounds = totalImportCostPounds + standingChargePounds - exportRevenuePounds;

        return {
            date: day.date,
            consumptionKwh: Math.round(day.consumptionKwh * 100) / 100,
            generationKwh: Math.round(day.generationKwh * 100) / 100,
            offPeakChargeKwh: Math.round(offPeakChargeKwh * 100) / 100,
            offPeakChargeCostPounds: Math.round(offPeakChargeCostPounds * 100) / 100,
            regularImportKwh: Math.round(regularImportKwh * 100) / 100,
            regularImportCostPounds: Math.round(regularImportCostPounds * 100) / 100,
            totalImportKwh: Math.round(day.gridImportKwh * 100) / 100,
            totalImportCostPounds: Math.round(totalImportCostPounds * 100) / 100,
            exportKwh: Math.round(day.gridExportKwh * 100) / 100,
            exportRevenuePounds: Math.round(exportRevenuePounds * 100) / 100,
            standingChargePounds: Math.round(standingChargePounds * 100) / 100,
            netCostPounds: Math.round(netCostPounds * 100) / 100,
        };
    });
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
