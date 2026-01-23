/**
 * Battery state at a specific point in time
 */
export interface BatteryState {
    /** State of Charge as a percentage (0-100) */
    socPercent: number;

    /** Stored energy in kilowatt-hours (kWh) */
    storedEnergyKwh: number;

    /** Power flow in kilowatts (kW)
     * Positive = charging, Negative = discharging, 0 = idle */
    powerKw: number;
}

/**
 * Battery energy flows for a half-hourly interval
 */
export interface BatteryIntervalFlow {
    /** ISO 8601 timestamp for interval start */
    intervalStart: string;

    /** ISO 8601 timestamp for interval end */
    intervalEnd: string;

    /** Energy charged into battery (kWh, always positive) */
    chargeKwh: number;

    /** Energy discharged from battery (kWh, always positive) */
    dischargeKwh: number;

    /** Battery state at the end of this interval */
    endState: BatteryState;
}

/**
 * Battery system configuration and constraints
 */
export interface BatteryConfig {
    /** Total usable capacity in kilowatt-hours (kWh) */
    capacityKwh: number;

    /** Maximum charge power in kilowatts (kW) */
    maxChargePowerKw: number;

    /** Maximum discharge power in kilowatts (kW) */
    maxDischargePowerKw: number;

    /** Round-trip efficiency as a decimal (0-1)
     * Typical values: 0.85-0.95 for lithium-ion batteries */
    roundTripEfficiency: number;

    /** Minimum allowed State of Charge as percentage (0-100)
     * Protects battery health, typically 10-20% */
    minSocPercent?: number;

    /** Maximum allowed State of Charge as percentage (0-100)
     * Typically 100%, but may be limited for longevity */
    maxSocPercent?: number;

    /** Initial State of Charge as percentage (0-100)
     * Starting condition for simulation, typically 50% */
    initialSocPercent?: number;
}

/**
 * Battery dispatch decision for a single interval
 */
export interface BatteryDispatch {
    /** Action taken: charge, discharge, or idle */
    action: 'charge' | 'discharge' | 'idle';

    /** Energy transferred in kWh (always positive) */
    energyKwh: number;

    /** Average power during interval in kW (always positive) */
    powerKw: number;

    /** State of Charge before this action (%) */
    socBefore: number;

    /** State of Charge after this action (%) */
    socAfter: number;
}
