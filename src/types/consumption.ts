/**
 * Half-hourly electricity consumption record from Octopus Energy API
 * UK settlement periods are 30 minutes (48 periods per day)
 */
export interface ConsumptionRecord {
    /** ISO 8601 timestamp marking the start of the 30-minute interval */
    intervalStart: string;

    /** ISO 8601 timestamp marking the end of the 30-minute interval */
    intervalEnd: string;

    /** Energy consumed during this interval in kilowatt-hours (kWh) */
    consumption: number;
}

/**
 * Time-ordered series of consumption records for a date range
 */
export interface ConsumptionTimeSeries {
    /** MPAN (Meter Point Administration Number) for the electricity meter */
    mpan: string;

    /** Serial number of the physical meter */
    serialNumber: string;

    /** Start date of the data range (inclusive) */
    periodStart: string;

    /** End date of the data range (exclusive) */
    periodEnd: string;

    /** Ordered array of half-hourly consumption records */
    records: ConsumptionRecord[];
}

/**
 * Request parameters for fetching consumption data from Octopus Energy
 */
export interface ConsumptionRequest {
    /** MPAN for the electricity meter */
    mpan: string;

    /** Serial number of the meter */
    serialNumber: string;

    /** Start date for data fetch (ISO 8601) */
    periodFrom: string;

    /** End date for data fetch (ISO 8601) */
    periodTo: string;

    /** API key for authentication */
    apiKey: string;
}
