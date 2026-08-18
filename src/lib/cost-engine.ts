import type { TariffConfig, IntervalCost, DailyCost, TariffRatePeriod } from '@/types';

/**
 * Cost calculation engine for grid import/export and tariff calculations
 * Supports both flat-rate and time-of-use tariffs
 */
export class CostEngine {
    private readonly tariffConfig: TariffConfig;
    private readonly halfHourlyRates: TariffRatePeriod[];

    constructor(tariffConfig: TariffConfig, halfHourlyRates?: TariffRatePeriod[]) {
        this.tariffConfig = tariffConfig;
        this.halfHourlyRates = halfHourlyRates ?? [];
    }

    /**
     * Get the import rate for a specific timestamp
     * Uses half-hourly rates if available, otherwise falls back to flat rate
     */
    private getImportRateForTimestamp(timestamp: Date): number {
        if (this.halfHourlyRates.length > 0) {
            const time = timestamp.getTime();

            for (const rate of this.halfHourlyRates) {
                const from = new Date(rate.validFrom).getTime();
                const to = new Date(rate.validTo).getTime();

                if (time >= from && time < to) {
                    return rate.ratePence;
                }
            }
        }

        // Fallback to flat rate
        return this.tariffConfig.import.standardRatePence;
    }

    /**
     * Calculate costs for a single half-hourly interval
     * Now supports time-of-use rates
     */
    calculateIntervalCost(
        intervalStart: string,
        gridImportKwh: number,
        gridExportKwh: number
    ): IntervalCost {
        // Get the rate for this specific time period
        const timestamp = new Date(intervalStart);
        const importRatePence = this.getImportRateForTimestamp(timestamp);
        const exportRatePence = this.tariffConfig.export.ratePence;

        const importCostPence = gridImportKwh * importRatePence;
        const exportRevenuePence = gridExportKwh * exportRatePence;
        const netCostPence = importCostPence - exportRevenuePence;

        return {
            intervalStart,
            importKwh: Math.round(gridImportKwh * 1000) / 1000,
            importCostPence: Math.round(importCostPence * 100) / 100,
            exportKwh: Math.round(gridExportKwh * 1000) / 1000,
            exportRevenuePence: Math.round(exportRevenuePence * 100) / 100,
            netCostPence: Math.round(netCostPence * 100) / 100,
        };
    }

    /**
     * Aggregate interval costs into a daily summary
     */
    aggregateDailyCosts(intervalCosts: IntervalCost[]): DailyCost[] {
        const dailyMap = new Map<string, IntervalCost[]>();

        // Group intervals by date
        for (const interval of intervalCosts) {
            const date = new Date(interval.intervalStart).toISOString().split('T')[0];
            if (!date) continue;

            const existing = dailyMap.get(date) ?? [];
            existing.push(interval);
            dailyMap.set(date, existing);
        }

        // Calculate daily totals
        const dailyCosts: DailyCost[] = [];

        for (const [date, intervals] of dailyMap.entries()) {
            const totalImportKwh = intervals.reduce((sum, i) => sum + i.importKwh, 0);
            const totalImportCostPence = intervals.reduce((sum, i) => sum + i.importCostPence, 0);
            const totalExportKwh = intervals.reduce((sum, i) => sum + i.exportKwh, 0);
            const totalExportRevenuePence = intervals.reduce(
                (sum, i) => sum + i.exportRevenuePence,
                0
            );

            const standingChargePence = this.tariffConfig.import.standingChargePence;
            const netCostPence = totalImportCostPence - totalExportRevenuePence + standingChargePence;

            dailyCosts.push({
                date,
                totalImportKwh: Math.round(totalImportKwh * 1000) / 1000,
                totalImportCostPence: Math.round(totalImportCostPence * 100) / 100,
                totalExportKwh: Math.round(totalExportKwh * 1000) / 1000,
                totalExportRevenuePence: Math.round(totalExportRevenuePence * 100) / 100,
                standingChargePence: Math.round(standingChargePence * 100) / 100,
                netCostPence: Math.round(netCostPence * 100) / 100,
            });
        }

        // Sort by date
        dailyCosts.sort((a, b) => a.date.localeCompare(b.date));

        return dailyCosts;
    }

    /**
     * Convert pence to pounds with proper rounding
     */
    static penceToPounds(pence: number): number {
        return Math.round((pence / 100) * 100) / 100;
    }

    /**
     * Convert pounds to pence
     */
    static poundsToPence(pounds: number): number {
        return Math.round(pounds * 100);
    }

    /**
     * Calculate annual standing charge cost
     */
    calculateAnnualStandingCharge(daysInYear = 365): number {
        return this.tariffConfig.import.standingChargePence * daysInYear;
    }

    /**
     * Estimate monthly bill from consumption (no solar/battery)
     */
    estimateBaselineMonthlyCost(monthlyConsumptionKwh: number, daysInMonth: number): number {
        const importCostPence = monthlyConsumptionKwh * this.tariffConfig.import.standardRatePence;
        const standingChargePence = this.tariffConfig.import.standingChargePence * daysInMonth;
        return CostEngine.penceToPounds(importCostPence + standingChargePence);
    }

    /**
     * Calculate savings percentage
     */
    static calculateSavingsPercentage(baselineCost: number, actualCost: number): number {
        if (baselineCost === 0) return 0;
        const savings = ((baselineCost - actualCost) / baselineCost) * 100;
        return Math.round(savings * 10) / 10;
    }
}

/**
 * Common UK tariff presets (2025/2026 rates)
 * Sources: Octopus Energy, British Gas, EDF websites
 * 
 * Battery Arbitrage Strategies:
 * 1. Octopus Flux: Off-peak import (2-5am) at ~10p, export at peak (4-7pm) at 25p
 * 2. Intelligent Go: Off-peak import (11:30pm-5:30am) at ~7p, standard during day
 * 3. Agile: Variable rates, can be negative or very high - charge when cheap, export when expensive
 * 
 * Eligibility Requirements:
 * - EV tariffs: Require registered EV charger
 * - Heat Pump: Require registered heat pump
 * - Solar/Export: Available to all with solar
 * - Standard: Available to all
 */
export const UK_TARIFF_PRESETS = {
    // BEST FOR SOLAR+BATTERY - Octopus Flux with time-of-use
    // Off-peak 02:00-05:00: ~10p import
    // Day 05:00-16:00 & 19:00-02:00: ~24p import  
    // Peak 16:00-19:00: ~30p import, 25p EXPORT
    octopusFlux: {
        displayLabel: 'Octopus Flux',
        recommended: true,
        category: 'solar' as const,
        eligibility: 'solar' as const,
        import: {
            type: 'flat' as const,
            standardRatePence: 24.50, // Day rate
            standingChargePence: 47.89,
            offPeakRatePence: 10.00, // 02:00-05:00 for battery charging
            peakRatePence: 29.85, // 16:00-19:00
        },
        export: {
            name: 'Octopus Flux Export',
            ratePence: 25.0, // Peak export rate (16:00-19:00) - this is the key!
        },
        description: 'Best for solar + battery. 10p overnight import, 25p peak export.',
    },
    // Intelligent Octopus Go - great for EV + battery
    // Off-peak 23:30-05:30: 7p
    // Day rate: 24p
    intelligentGo: {
        displayLabel: 'Intelligent Go',
        recommended: false,
        category: 'ev' as const,
        eligibility: 'ev' as const,
        import: {
            type: 'go' as const,
            standardRatePence: 24.50,
            standingChargePence: 47.43,
            offPeakRatePence: 7.00, // 23:30-05:30 super cheap!
        },
        export: {
            name: 'Octopus Outgoing Fixed',
            ratePence: 15.0,
        },
        description: 'Requires EV charger. 7p overnight (23:30-05:30), 24p day rate.',
    },
    // Octopus Go (non-EV version) - simple time-of-use
    octopusGo: {
        displayLabel: 'Octopus Go',
        recommended: false,
        category: 'ev' as const,
        eligibility: 'ev' as const,
        import: {
            type: 'go' as const,
            standardRatePence: 24.95,
            standingChargePence: 50.29,
            offPeakRatePence: 9.00, // 00:30-04:30
        },
        export: {
            name: 'Octopus Outgoing Fixed',
            ratePence: 15.0,
        },
        description: 'Requires EV charger. 9p overnight (00:30-04:30), 25p day rate.',
    },
    // Octopus Cosy - for heat pumps (3 off-peak periods)
    octopusCosy: {
        displayLabel: 'Octopus Cosy',
        recommended: false,
        category: 'heatpump' as const,
        eligibility: 'heatpump' as const,
        import: {
            type: 'flat' as const,
            standardRatePence: 26.70,
            standingChargePence: 47.89,
            offPeakRatePence: 10.00, // 04:00-07:00, 13:00-16:00, 22:00-00:00
        },
        export: {
            name: 'Octopus Outgoing Fixed',
            ratePence: 15.0,
        },
        description: 'Requires heat pump. 10p off-peak (3 windows), 27p standard.',
    },
    // Octopus Tracker - follows wholesale prices
    octopusTracker: {
        displayLabel: 'Octopus Tracker',
        recommended: false,
        category: 'standard' as const,
        eligibility: 'all' as const,
        import: {
            type: 'tracker' as const,
            standardRatePence: 20.50, // Varies daily
            standingChargePence: 47.89,
        },
        export: {
            name: 'Octopus Outgoing Fixed',
            ratePence: 15.0,
        },
        description: 'Follows wholesale prices daily. Currently ~20.5p average.',
    },
    // Agile import with Agile Outgoing export
    octopusAgile: {
        displayLabel: 'Octopus Agile',
        recommended: false,
        category: 'standard' as const,
        eligibility: 'all' as const,
        import: {
            type: 'agile' as const,
            standardRatePence: 20.0, // Average, varies 5p-50p+
            standingChargePence: 47.89,
        },
        export: {
            name: 'Octopus Agile Outgoing',
            ratePence: 15.0, // Average, can be 30p+ at peak
        },
        description: 'Variable half-hourly rates. Average 20p import, 15p export.',
    },
    // Standard flexible with fixed export
    octopusFlexible: {
        displayLabel: 'Octopus Flexible',
        recommended: false,
        category: 'standard' as const,
        eligibility: 'all' as const,
        import: {
            type: 'flat' as const,
            standardRatePence: 24.50,
            standingChargePence: 60.10,
        },
        export: {
            name: 'Octopus Outgoing Fixed',
            ratePence: 15.0,
        },
        description: 'Simple flat rate. 24.5p import, 15p export.',
    },
    // No export agreement - off-peak import only, for modelling battery-only
    // self-consumption arbitrage with no SEG/export deal in place
    noExport: {
        displayLabel: 'Off-Peak, No Export',
        recommended: false,
        category: 'standard' as const,
        eligibility: 'all' as const,
        import: {
            type: 'go' as const,
            standardRatePence: 24.50,
            standingChargePence: 47.89,
            offPeakRatePence: 7.50, // Cheap overnight rate for battery charging
        },
        export: {
            name: 'No Export Agreement',
            ratePence: 0,
        },
        description: 'Cheap off-peak import for battery charging, no export revenue (no SEG agreement).',
    },
    // EDF GoElectric (EV tariff)
    edfGoElectric: {
        displayLabel: 'EDF GoElectric',
        recommended: false,
        category: 'ev' as const,
        eligibility: 'ev' as const,
        import: {
            type: 'go' as const,
            standardRatePence: 27.51,
            standingChargePence: 45.75,
            offPeakRatePence: 7.50, // 00:00-07:00
        },
        export: {
            name: 'Smart Export Guarantee',
            ratePence: 4.5,
        },
        description: 'Requires EV charger. 7.5p overnight (00:00-07:00), 27.5p day.',
    },
    // British Gas Electric Drivers
    bgElectricDrivers: {
        displayLabel: 'BG Electric Drivers',
        recommended: false,
        category: 'ev' as const,
        eligibility: 'ev' as const,
        import: {
            type: 'go' as const,
            standardRatePence: 28.70,
            standingChargePence: 50.00,
            offPeakRatePence: 8.00, // 00:00-05:00
        },
        export: {
            name: 'Smart Export Guarantee',
            ratePence: 3.0,
        },
        description: 'Requires EV charger. 8p overnight (00:00-05:00), 28.7p day.',
    },
    // OVO Drive Anytime
    ovoDriveAnytime: {
        displayLabel: 'OVO Drive Anytime',
        recommended: false,
        category: 'ev' as const,
        eligibility: 'ev' as const,
        import: {
            type: 'flat' as const,
            standardRatePence: 25.00,
            standingChargePence: 49.00,
        },
        export: {
            name: 'Smart Export Guarantee',
            ratePence: 4.0,
        },
        description: 'Requires EV charger. 25p flat rate.',
    },
    // Ofgem Price Cap (baseline comparison)
    ofgemPriceCap: {
        displayLabel: 'Ofgem Price Cap',
        recommended: false,
        category: 'standard' as const,
        eligibility: 'all' as const,
        import: {
            type: 'flat' as const,
            standardRatePence: 24.50, // Q1 2025 cap
            standingChargePence: 60.10, // Daily standing charge
        },
        export: {
            name: 'Smart Export Guarantee (min)',
            ratePence: 4.0, // Minimum SEG rate
        },
        description: 'Ofgem price cap rate. Use as baseline comparison.',
    },
    // Standard SEG (low export) - worst case comparison
    standardSEG: {
        displayLabel: 'Standard + SEG',
        recommended: false,
        category: 'standard' as const,
        eligibility: 'all' as const,
        import: {
            type: 'flat' as const,
            standardRatePence: 24.50,
            standingChargePence: 60.10,
        },
        export: {
            name: 'Smart Export Guarantee',
            ratePence: 4.1, // Basic SEG rate - worst case
        },
        description: 'Basic export. 24.5p import, only 4.1p export.',
    },
} as const;

/**
 * Tariff categories for filtering
 */
export type TariffCategory = 'solar' | 'ev' | 'heatpump' | 'standard';

/**
 * Tariff eligibility types
 */
export type TariffEligibility = 'all' | 'solar' | 'ev' | 'heatpump';

/**
 * Get tariff presets filtered by category
 */
export function getTariffsByCategory(category: TariffCategory | 'all' = 'all') {
    if (category === 'all') {
        return UK_TARIFF_PRESETS;
    }
    return Object.fromEntries(
        Object.entries(UK_TARIFF_PRESETS).filter(([, tariff]) => tariff.category === category)
    );
}

/**
 * Get tariff presets filtered by eligibility
 * Returns tariffs available to users with the given eligibility
 */
export function getTariffsByEligibility(eligibility: TariffEligibility | 'all' = 'all') {
    if (eligibility === 'all') {
        return UK_TARIFF_PRESETS;
    }

    // Users with solar can access solar and standard tariffs
    // Users with EV can access EV, solar (if they have solar), and standard tariffs
    // Users with heat pump can access heat pump, solar (if they have solar), and standard tariffs
    return Object.fromEntries(
        Object.entries(UK_TARIFF_PRESETS).filter(([, tariff]) => {
            // Always include 'all' eligibility tariffs
            if (tariff.eligibility === 'all') return true;
            // Include if user has specific equipment
            if (tariff.eligibility === eligibility) return true;
            // Solar tariffs available to those with solar
            if (tariff.eligibility === 'solar' && eligibility === 'solar') return true;
            return false;
        })
    );
}
