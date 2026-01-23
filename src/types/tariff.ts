/**
 * Grid import tariff structure
 * V1: Flat rate only (no time-of-use)
 */
export interface ImportTariff {
    /** Tariff type identifier */
    type: 'flat' | 'agile' | 'go' | 'tracker';

    /** Standard import rate in £/kWh */
    standardRatePence: number;

    /** Standing charge in pence per day */
    standingChargePence: number;

    /** Optional: Off-peak rate for time-of-use tariffs (future) */
    offPeakRatePence?: number;

    /** Optional: Peak rate for time-of-use tariffs (future) */
    peakRatePence?: number;
}

/**
 * Export tariff structure (Smart Export Guarantee)
 */
export interface ExportTariff {
    /** Tariff provider/name (e.g., "Octopus Outgoing Fixed", "SEG") */
    name: string;

    /** Export rate in pence per kWh */
    ratePence: number;

    /** Whether this is a variable export tariff (future) */
    isVariable?: boolean;
}

/**
 * Complete tariff configuration for a household
 */
export interface TariffConfig {
    /** Grid import tariff details */
    import: ImportTariff;

    /** Grid export tariff details (SEG) */
    export: ExportTariff;

    /** Optional: Monthly direct debit amount in £ */
    monthlyDirectDebitPounds?: number;
}

/**
 * Calculated costs for a single half-hourly interval
 */
export interface IntervalCost {
    /** ISO 8601 timestamp for interval start */
    intervalStart: string;

    /** Energy imported from grid in kWh */
    importKwh: number;

    /** Cost of imported energy in pence */
    importCostPence: number;

    /** Energy exported to grid in kWh */
    exportKwh: number;

    /** Revenue from exported energy in pence */
    exportRevenuePence: number;

    /** Net cost (import cost - export revenue) in pence */
    netCostPence: number;
}

/**
 * Aggregated costs for a day
 */
export interface DailyCost {
    /** Date in YYYY-MM-DD format */
    date: string;

    /** Total energy imported in kWh */
    totalImportKwh: number;

    /** Total import cost in pence */
    totalImportCostPence: number;

    /** Total energy exported in kWh */
    totalExportKwh: number;

    /** Total export revenue in pence */
    totalExportRevenuePence: number;

    /** Standing charge for this day in pence */
    standingChargePence: number;

    /** Net daily cost in pence (import - export + standing charge) */
    netCostPence: number;
}
