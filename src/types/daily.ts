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
