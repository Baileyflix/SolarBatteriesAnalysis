/**
 * Solar irradiance data for a specific time interval
 * Used to calculate PV generation potential
 */
export interface IrradianceRecord {
    /** ISO 8601 timestamp for the interval start */
    intervalStart: string;

    /** ISO 8601 timestamp for the interval end */
    intervalEnd: string;

    /** Global Horizontal Irradiance in W/m² */
    ghi: number;

    /** Direct Normal Irradiance in W/m² (optional) */
    dni?: number;

    /** Diffuse Horizontal Irradiance in W/m² (optional) */
    dhi?: number;
}

/**
 * PV generation output for a half-hourly interval
 */
export interface GenerationRecord {
    /** ISO 8601 timestamp for the interval start */
    intervalStart: string;

    /** ISO 8601 timestamp for the interval end */
    intervalEnd: string;

    /** Generated electricity in kilowatt-hours (kWh) */
    generation: number;
}

/**
 * Time-ordered series of PV generation records
 */
export interface GenerationTimeSeries {
    /** System size in kilowatts peak (kWp) */
    systemSizeKwp: number;

    /** Performance ratio (0-1, typically 0.75-0.85 for UK systems) */
    performanceRatio: number;

    /** Location identifier (postcode, lat/long, etc.) */
    location: string;

    /** Start date of the generation data */
    periodStart: string;

    /** End date of the generation data */
    periodEnd: string;

    /** Ordered array of half-hourly generation records */
    records: GenerationRecord[];
}

/**
 * Configuration for PV system sizing and performance
 */
export interface PVSystemConfig {
    /** System capacity in kilowatts peak (kWp) */
    systemSizeKwp: number;

    /** Performance ratio accounting for losses (inverter, wiring, soiling, etc.)
     * Typical values: 0.75-0.85 for UK residential systems */
    performanceRatio: number;

    /** Panel tilt angle in degrees from horizontal (0-90) */
    tiltAngle?: number;

    /** Panel azimuth in degrees (0 = North, 90 = East, 180 = South, 270 = West) */
    azimuthAngle?: number;
}
