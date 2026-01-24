/**
 * Grid import tariff structure
 * Supports flat-rate and time-of-use tariffs
 */
export interface ImportTariff {
    /** Tariff type identifier */
    type: 'flat' | 'agile' | 'go' | 'tracker' | 'cosy' | 'flux';

    /** Standard import rate in pence/kWh (for flat tariffs or fallback) */
    standardRatePence: number;

    /** Standing charge in pence per day */
    standingChargePence: number;

    /** Optional: Off-peak rate for time-of-use tariffs */
    offPeakRatePence?: number;

    /** Optional: Peak rate for time-of-use tariffs */
    peakRatePence?: number;

    /** 
     * Half-hourly rates keyed by ISO timestamp or time slot
     * Used for accurate TOU calculations
     */
    halfHourlyRates?: Map<string, number>;
}

/**
 * A single rate period in a time-of-use tariff
 */
export interface TariffRatePeriod {
    /** Rate in pence per kWh (inc VAT) */
    ratePence: number;

    /** Start time as ISO timestamp */
    validFrom: string;

    /** End time as ISO timestamp */
    validTo: string;
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

/**
 * User's actual tariff information from Octopus API
 */
export interface ActualTariffInfo {
    /** Product code (e.g., "FLUX-EXPORT-24-07-01") */
    productCode: string;

    /** Tariff code including GSP region */
    tariffCode: string;

    /** Human-readable tariff name */
    displayName: string;

    /** Full name of the tariff */
    fullName?: string;

    /** Unit rate in pence/kWh (average or standard rate) */
    unitRatePence: number;

    /** Standing charge in pence/day */
    standingChargePence: number;

    /** Export rate if applicable (pence/kWh) */
    exportRatePence?: number;

    /** Whether this is a variable/agile tariff */
    isVariable?: boolean;

    /** Whether this tariff has time-of-use rates */
    hasTimeOfUseRates?: boolean;

    /** Off-peak rate if available (pence/kWh) */
    offPeakRatePence?: number;

    /** Peak rate if available (pence/kWh) */
    peakRatePence?: number;

    /** Half-hourly rates for the consumption period */
    halfHourlyRates?: TariffRatePeriod[];

    /** Agreement start date */
    validFrom?: string;

    /** Agreement end date (if fixed term) */
    validTo?: string;

    /** Tags from the tariff (e.g., ["green", "flux"]) */
    tags?: string[];
}

/**
 * Actual cost data from smart meter readings
 */
export interface ActualCostData {
    /** Date in YYYY-MM-DD format */
    date: string;

    /** Actual consumption in kWh */
    consumptionKwh: number;

    /** Actual cost in pence (excl. VAT) */
    costPence: number;

    /** Actual cost in pence (incl. VAT) */
    costWithVatPence: number;
}

/**
 * Summary of actual costs from smart meter
 */
export interface ActualCostSummary {
    /** Total consumption for period in kWh */
    totalConsumptionKwh: number;

    /** Total cost in pounds (incl. VAT) */
    totalCostPounds: number;

    /** Daily breakdown */
    dailyCosts: ActualCostData[];

    /** Data period start */
    periodStart: string;

    /** Data period end */
    periodEnd: string;
}
