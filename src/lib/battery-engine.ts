import type {
    BatteryConfig,
    BatteryState,
    BatteryIntervalFlow,
    BatteryDispatch,
} from '@/types';

/**
 * Battery dispatch engine implementing greedy energy routing logic
 * Priority: PV → Load → Battery → Grid Export → Grid Import
 * 
 * When capacityKwh is 0, the engine operates in "no battery" mode:
 * excess PV goes directly to grid export, shortfall comes from grid import.
 */
export class BatteryEngine {
    private readonly config: BatteryConfig;
    private currentState: BatteryState;
    private readonly noBatteryMode: boolean;

    constructor(config: BatteryConfig) {
        // Check for "no battery" mode before validation
        this.noBatteryMode = config.capacityKwh === 0;
        this.config = this.noBatteryMode
            ? this.createNoBatteryConfig()
            : this.validateAndNormalizeConfig(config);
        this.currentState = this.initializeState();
    }

    /**
     * Create a minimal config for "no battery" mode
     */
    private createNoBatteryConfig(): BatteryConfig {
        return {
            capacityKwh: 0,
            maxChargePowerKw: 0,
            maxDischargePowerKw: 0,
            roundTripEfficiency: 1,
            minSocPercent: 0,
            maxSocPercent: 0,
            initialSocPercent: 0,
        };
    }

    /**
     * Validate configuration and apply defaults
     */
    private validateAndNormalizeConfig(config: BatteryConfig): BatteryConfig {
        if (config.capacityKwh < 0) {
            throw new Error('Battery capacity cannot be negative');
        }
        if (config.capacityKwh === 0) {
            // Handled by noBatteryMode
            return this.createNoBatteryConfig();
        }
        if (config.maxChargePowerKw <= 0 || config.maxDischargePowerKw <= 0) {
            throw new Error('Battery charge/discharge power must be positive');
        }
        if (config.roundTripEfficiency <= 0 || config.roundTripEfficiency > 1) {
            throw new Error('Round-trip efficiency must be between 0 and 1');
        }

        return {
            ...config,
            minSocPercent: config.minSocPercent ?? 10,
            maxSocPercent: config.maxSocPercent ?? 100,
            initialSocPercent: config.initialSocPercent ?? 50,
        };
    }

    /**
     * Initialize battery state based on configuration
     */
    private initializeState(): BatteryState {
        const socPercent = this.config.initialSocPercent ?? 50;
        const storedEnergyKwh = (socPercent / 100) * this.config.capacityKwh;

        return {
            socPercent,
            storedEnergyKwh,
            powerKw: 0,
        };
    }

    /**
     * Reset battery to initial state
     */
    reset(): void {
        this.currentState = this.initializeState();
    }

    /**
     * Get current battery state
     */
    getState(): BatteryState {
        return { ...this.currentState };
    }

    /**
     * Process a single half-hourly interval with greedy dispatch logic
     * 
     * @param pvGenerationKwh - Solar PV generated this interval
     * @param loadDemandKwh - Household consumption this interval
     * @param intervalStart - Start timestamp of interval
     * @param intervalEnd - End timestamp of interval
     * @returns Energy flows and battery state for this interval
     */
    processInterval(
        pvGenerationKwh: number,
        loadDemandKwh: number,
        intervalStart: string,
        intervalEnd: string
    ): BatteryIntervalFlow & { gridImportKwh: number; gridExportKwh: number } {
        // Calculate net energy position
        const netEnergyKwh = pvGenerationKwh - loadDemandKwh;

        // In "no battery" mode, all excess goes to grid export, all shortfall comes from grid import
        if (this.noBatteryMode) {
            return {
                intervalStart,
                intervalEnd,
                chargeKwh: 0,
                dischargeKwh: 0,
                gridImportKwh: Math.round(Math.max(0, -netEnergyKwh) * 1000) / 1000,
                gridExportKwh: Math.round(Math.max(0, netEnergyKwh) * 1000) / 1000,
                endState: this.getState(),
            };
        }

        let chargeKwh = 0;
        let dischargeKwh = 0;
        let gridImportKwh = 0;
        let gridExportKwh = 0;

        if (netEnergyKwh > 0) {
            // Excess PV generation - try to charge battery
            const dispatch = this.chargeFromExcess(netEnergyKwh);
            chargeKwh = dispatch.energyKwh;

            // Remaining excess goes to grid export
            gridExportKwh = netEnergyKwh - chargeKwh;
        } else {
            // Load exceeds PV - try to discharge battery
            const shortfallKwh = Math.abs(netEnergyKwh);
            const dispatch = this.dischargeToMeetLoad(shortfallKwh);
            dischargeKwh = dispatch.energyKwh;

            // Remaining shortfall met by grid import
            gridImportKwh = shortfallKwh - dischargeKwh;
        }

        const endState = this.getState();

        return {
            intervalStart,
            intervalEnd,
            chargeKwh: Math.round(chargeKwh * 1000) / 1000,
            dischargeKwh: Math.round(dischargeKwh * 1000) / 1000,
            gridImportKwh: Math.round(gridImportKwh * 1000) / 1000,
            gridExportKwh: Math.round(gridExportKwh * 1000) / 1000,
            endState,
        };
    }

    /**
     * Attempt to charge battery from excess PV generation
     * Returns actual energy charged (may be less than available due to constraints)
     * 
     * Energy flow: PV → (efficiency loss) → Battery storage
     * If we have 10 kWh from PV and 90% efficiency, we store 9 kWh
     */
    private chargeFromExcess(availableEnergyKwh: number): BatteryDispatch {
        const socBefore = this.currentState.socPercent;

        // Maximum energy that can be added considering SoC limit
        const maxSocKwh = (this.config.maxSocPercent! / 100) * this.config.capacityKwh;
        const roomAvailableKwh = maxSocKwh - this.currentState.storedEnergyKwh;

        // Maximum energy that can be charged in 30 minutes considering power limit
        const maxChargePeriodKwh = this.config.maxChargePowerKw * 0.5;

        // Account for charging efficiency (energy lost during charge)
        // If efficiency is 90%, sqrt(0.9) ≈ 0.949 for charging
        const chargingEfficiency = Math.sqrt(this.config.roundTripEfficiency);

        // How much can we actually store from the available PV?
        // Limited by: room in battery, charge power, and what's available from PV
        const energyToStoreKwh = Math.min(
            roomAvailableKwh,
            maxChargePeriodKwh,
            availableEnergyKwh * chargingEfficiency // PV energy × efficiency = stored energy
        );

        // How much PV energy was consumed to store this amount?
        const energyFromPV = energyToStoreKwh / chargingEfficiency;

        // Update battery state
        this.currentState.storedEnergyKwh += energyToStoreKwh;
        this.currentState.socPercent =
            (this.currentState.storedEnergyKwh / this.config.capacityKwh) * 100;
        this.currentState.powerKw = energyToStoreKwh / 0.5; // Average power over 30 min

        const socAfter = this.currentState.socPercent;

        return {
            action: 'charge',
            energyKwh: energyFromPV, // Return PV energy consumed (for grid export calculation)
            powerKw: this.currentState.powerKw,
            socBefore,
            socAfter,
        };
    }

    /**
     * Attempt to discharge battery to meet load shortfall
     * Returns actual energy provided (may be less than needed due to constraints)
     * 
     * Energy flow: Battery storage → (efficiency loss) → Load
     * If we discharge 10 kWh from battery with 90% efficiency, load gets 9 kWh
     */
    private dischargeToMeetLoad(requiredEnergyKwh: number): BatteryDispatch {
        const socBefore = this.currentState.socPercent;

        // Minimum energy that must remain considering SoC limit
        const minSocKwh = (this.config.minSocPercent! / 100) * this.config.capacityKwh;
        const availableStoredKwh = Math.max(0, this.currentState.storedEnergyKwh - minSocKwh);

        // Maximum energy that can be discharged in 30 minutes considering power limit
        const maxDischargePeriodKwh = this.config.maxDischargePowerKw * 0.5;

        // Account for discharging efficiency (energy lost during discharge)
        // If efficiency is 90%, sqrt(0.9) ≈ 0.949 for discharging
        const dischargingEfficiency = Math.sqrt(this.config.roundTripEfficiency);

        // How much energy can we deliver to the load?
        // Limited by: what we can get from storage (×efficiency), discharge power, what's needed
        const energyToLoadKwh = Math.min(
            availableStoredKwh * dischargingEfficiency, // Stored × efficiency = delivered
            maxDischargePeriodKwh,
            requiredEnergyKwh
        );

        // How much energy was actually removed from storage?
        const energyFromBattery = energyToLoadKwh / dischargingEfficiency;

        // Update battery state
        this.currentState.storedEnergyKwh -= energyFromBattery;
        this.currentState.socPercent =
            (this.currentState.storedEnergyKwh / this.config.capacityKwh) * 100;
        this.currentState.powerKw = -energyToLoadKwh / 0.5; // Negative for discharge

        const socAfter = this.currentState.socPercent;

        return {
            action: 'discharge',
            energyKwh: energyToLoadKwh, // Return energy delivered to load (for grid import calculation)
            powerKw: Math.abs(this.currentState.powerKw),
            socBefore,
            socAfter,
        };
    }

    /**
     * Calculate total battery throughput (charge + discharge) over a period
     */
    static calculateThroughput(flows: BatteryIntervalFlow[]): number {
        return flows.reduce((total, flow) => total + flow.chargeKwh + flow.dischargeKwh, 0);
    }

    /**
     * Calculate battery cycling (full charge-discharge cycles)
     * One cycle = capacity charged + capacity discharged / (2 × capacity)
     */
    static calculateCycles(flows: BatteryIntervalFlow[], capacityKwh: number): number {
        const throughput = this.calculateThroughput(flows);
        return throughput / (2 * capacityKwh);
    }

    /**
     * Calculate average State of Charge over a period
     */
    static calculateAverageSoC(flows: BatteryIntervalFlow[]): number {
        if (flows.length === 0) return 0;
        const totalSoC = flows.reduce((sum, flow) => sum + flow.endState.socPercent, 0);
        return totalSoC / flows.length;
    }
}

/**
 * Typical battery configurations for UK home installations
 */
export const UK_BATTERY_PRESETS = {
    small: {
        capacityKwh: 5,
        maxChargePowerKw: 2.5,
        maxDischargePowerKw: 2.5,
        roundTripEfficiency: 0.9,
        minSocPercent: 10,
        maxSocPercent: 100,
        initialSocPercent: 50,
        description: 'Small battery (5kWh)',
    },
    medium: {
        capacityKwh: 10,
        maxChargePowerKw: 5,
        maxDischargePowerKw: 5,
        roundTripEfficiency: 0.92,
        minSocPercent: 10,
        maxSocPercent: 100,
        initialSocPercent: 50,
        description: 'Medium battery (10kWh)',
    },
    large: {
        capacityKwh: 15,
        maxChargePowerKw: 7.5,
        maxDischargePowerKw: 7.5,
        roundTripEfficiency: 0.93,
        minSocPercent: 10,
        maxSocPercent: 100,
        initialSocPercent: 50,
        description: 'Large battery (15kWh)',
    },
} as const;
