import type {
    IrradianceRecord,
    GenerationRecord,
    GenerationTimeSeries,
    PVSystemConfig,
} from '@/types';

/**
 * Calculate PV generation from solar irradiance data
 * Implements the standard PV performance equation with system-specific parameters
 */
export class SolarGenerator {
    private readonly config: PVSystemConfig;

    constructor(config: PVSystemConfig) {
        this.config = config;
    }

    /**
     * Generate a complete time series of PV output from irradiance data
     */
    generateTimeSeries(
        irradianceData: IrradianceRecord[],
        location: string
    ): GenerationTimeSeries {
        const records = irradianceData.map((irradiance) =>
            this.calculateIntervalGeneration(irradiance)
        );

        return {
            systemSizeKwp: this.config.systemSizeKwp,
            performanceRatio: this.config.performanceRatio,
            location,
            periodStart: irradianceData[0]?.intervalStart ?? '',
            periodEnd: irradianceData[irradianceData.length - 1]?.intervalEnd ?? '',
            records,
        };
    }

    /**
     * Calculate PV generation for a single half-hourly interval
     * 
     * Formula (IEC 61724 / PVGIS methodology):
     *   E = (G / G_STC) × P_peak × PR × Δt
     * 
     * Where:
     *   E = Energy output (kWh)
     *   G = Global Horizontal Irradiance (W/m²)
     *   G_STC = 1000 W/m² (Standard Test Conditions)
     *   P_peak = System rated power (kWp)
     *   PR = Performance Ratio (typically 0.75-0.85, accounts for inverter, cables, temp, soiling)
     *   Δt = Time interval (0.5 hours for half-hourly data)
     * 
     * Reference: https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis
     */
    private calculateIntervalGeneration(irradiance: IrradianceRecord): GenerationRecord {
        // Standard Test Conditions irradiance is 1000 W/m²
        const stcIrradiance = 1000;

        // Time duration of interval in hours (30 minutes = 0.5 hours)
        const intervalHours = 0.5;

        // Calculate generation using the IEC 61724 PV performance equation
        // PV output scales linearly with irradiance under ideal conditions
        const generationKwh =
            (irradiance.ghi / stcIrradiance) *
            this.config.systemSizeKwp *
            this.config.performanceRatio *
            intervalHours;

        return {
            intervalStart: irradiance.intervalStart,
            intervalEnd: irradiance.intervalEnd,
            generation: Math.max(0, Math.round(generationKwh * 1000) / 1000), // Round to 3 decimal places, ensure non-negative
        };
    }

    /**
     * Calculate total daily generation from a series of records
     */
    static calculateDailyTotal(records: GenerationRecord[], date: string): number {
        const targetDate = new Date(date).toISOString().split('T')[0];

        return records
            .filter((record) => {
                const recordDate = new Date(record.intervalStart).toISOString().split('T')[0];
                return recordDate === targetDate;
            })
            .reduce((sum, record) => sum + record.generation, 0);
    }

    /**
     * Calculate total monthly generation
     */
    static calculateMonthlyTotal(records: GenerationRecord[], yearMonth: string): number {
        const [year, month] = yearMonth.split('-');

        return records
            .filter((record) => {
                const recordDate = new Date(record.intervalStart);
                const recordYear = recordDate.getFullYear().toString();
                const recordMonth = (recordDate.getMonth() + 1).toString().padStart(2, '0');
                return recordYear === year && recordMonth === month;
            })
            .reduce((sum, record) => sum + record.generation, 0);
    }

    /**
     * Estimate annual generation for a PV system (simplified)
     * Based on typical UK solar irradiance of ~950-1100 kWh/m²/year
     */
    static estimateAnnualGeneration(systemSizeKwp: number, performanceRatio: number): number {
        // UK average annual irradiance: ~1000 kWh/m²/year
        const ukAverageIrradiance = 1000;
        const stcIrradiance = 1000; // W/m² at Standard Test Conditions

        // Annual generation = System Size × Performance Ratio × Annual Irradiance / STC
        return systemSizeKwp * performanceRatio * (ukAverageIrradiance / stcIrradiance);
    }

    /**
     * Calculate performance ratio from real vs. theoretical output
     * Useful for calibrating the model against actual measurements
     */
    static calculateActualPerformanceRatio(
        actualGenerationKwh: number,
        theoreticalGenerationKwh: number
    ): number {
        if (theoreticalGenerationKwh === 0) return 0;
        return actualGenerationKwh / theoreticalGenerationKwh;
    }

    /**
     * Estimate system size needed to meet annual consumption
     */
    static estimateSystemSize(
        annualConsumptionKwh: number,
        performanceRatio: number,
        targetCoveragePercent: number
    ): number {
        const targetGenerationKwh = annualConsumptionKwh * (targetCoveragePercent / 100);
        const ukAverageIrradiance = 1000;
        const stcIrradiance = 1000;

        const systemSizeKwp =
            targetGenerationKwh / (performanceRatio * (ukAverageIrradiance / stcIrradiance));

        return Math.round(systemSizeKwp * 10) / 10; // Round to 1 decimal place
    }
}

/**
 * Typical PV system configurations for UK installations
 */
export const UK_PV_PRESETS = {
    small: {
        systemSizeKwp: 3.5,
        performanceRatio: 0.8,
        description: 'Small domestic system (8-10 panels)',
    },
    medium: {
        systemSizeKwp: 5.0,
        performanceRatio: 0.82,
        description: 'Medium domestic system (12-14 panels)',
    },
    large: {
        systemSizeKwp: 7.0,
        performanceRatio: 0.85,
        description: 'Large domestic system (16-20 panels)',
    },
} as const;
