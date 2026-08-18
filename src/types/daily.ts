/**
 * Daily energy record - simplified from half-hourly for easier analysis
 */
export interface DailyEnergyRecord {
    /** Date in YYYY-MM-DD format */
    date: string;

    /** Total consumption for the day in kWh */
    consumptionKwh: number;

    /** Total solar generation for the day in kWh */
    generationKwh: number;

    /** Grid import for the day in kWh */
    gridImportKwh: number;

    /** Grid export for the day in kWh */
    gridExportKwh: number;

    /** Battery arbitrage: kWh charged from grid overnight at off-peak rate */
    overnightChargeKwh?: number;

    /** Battery arbitrage: kWh exported during peak hours (16:00-19:00) */
    peakExportKwh?: number;
}

/**
 * Per-day cost breakdown, splitting grid import into the off-peak portion
 * used to charge the battery vs. the regular-rate portion needed to make
 * up the rest of that day's usage.
 */
export interface DailyCostBreakdown {
    /** Date in YYYY-MM-DD format */
    date: string;

    /** Total household consumption for the day in kWh */
    consumptionKwh: number;

    /** Total solar generation for the day in kWh (0 if no solar) */
    generationKwh: number;

    /** kWh charged from the grid overnight at the off-peak rate */
    offPeakChargeKwh: number;

    /** Cost of the off-peak charging in £ */
    offPeakChargeCostPounds: number;

    /** Remaining grid import at the standard rate, needed to cover the rest of usage, in kWh */
    regularImportKwh: number;

    /** Cost of the regular-rate import in £ */
    regularImportCostPounds: number;

    /** Total grid import for the day in kWh (offPeakChargeKwh + regularImportKwh) */
    totalImportKwh: number;

    /** Total import cost for the day in £ */
    totalImportCostPounds: number;

    /** Energy exported to the grid in kWh */
    exportKwh: number;

    /** Revenue from exported energy in £ */
    exportRevenuePounds: number;

    /** Standing charge for the day in £ */
    standingChargePounds: number;

    /** Net cost for the day in £ (import cost + standing charge - export revenue) */
    netCostPounds: number;
}

/**
 * Daily solar irradiance from NASA POWER
 */
export interface DailyIrradiance {
    /** Date in YYYY-MM-DD format */
    date: string;

    /** Global Horizontal Irradiance in kWh/m²/day */
    ghiKwhPerM2: number;
}

/**
 * Daily generation output
 */
export interface DailyGeneration {
    /** Date in YYYY-MM-DD format */
    date: string;

    /** Generated electricity in kWh */
    generationKwh: number;
}

/**
 * Daily consumption from Octopus Energy
 */
export interface DailyConsumption {
    /** Date in YYYY-MM-DD format */
    date: string;

    /** Total consumption for the day in kWh */
    consumptionKwh: number;
}
