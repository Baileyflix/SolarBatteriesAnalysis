import { useState, useCallback } from 'react';
import type { GenerationTimeSeries, GenerationRecord, PVSystemConfig } from '@/types';
import { SolarDataClient, SolarDataError, postcodeToCoordinates } from '@/services/solar-data';
import { calculateDailyGeneration, type PVSystemConfig as DailyPVConfig } from '@/lib/daily-simulator';

interface UseSolarDataResult {
    data: GenerationTimeSeries | null;
    loading: boolean;
    error: string | null;
    generateData: (params: {
        postcode: string;
        periodFrom: string;
        periodTo: string;
        systemConfig: PVSystemConfig;
    }) => Promise<GenerationTimeSeries | null>;
    reset: () => void;
}

/**
 * Custom hook for fetching solar irradiance and generating PV output data
 * 
 * Uses daily data from NASA POWER API and calculates generation directly.
 * Creates one "record" per day for compatibility with the simulation pipeline.
 */
export function useSolarData(): UseSolarDataResult {
    const [data, setData] = useState<GenerationTimeSeries | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateData = useCallback(
        async (params: {
            postcode: string;
            periodFrom: string;
            periodTo: string;
            systemConfig: PVSystemConfig;
        }): Promise<GenerationTimeSeries | null> => {
            setLoading(true);
            setError(null);

            try {
                // Convert postcode to coordinates (async call to postcodes.io)
                const location = await postcodeToCoordinates(params.postcode);

                // Fetch DAILY solar irradiance data from NASA POWER API
                const client = new SolarDataClient();
                const dailyIrradiance = await client.fetchDailyIrradiance(
                    location,
                    params.periodFrom,
                    params.periodTo
                );

                // Calculate daily generation using the proven formula
                // Generation = GHI (kWh/m²/day) × System Size (kWp) × Performance Ratio
                const pvConfig: DailyPVConfig = {
                    systemSizeKwp: params.systemConfig.systemSizeKwp,
                    performanceRatio: params.systemConfig.performanceRatio,
                };
                const dailyGeneration = calculateDailyGeneration(dailyIrradiance, pvConfig);

                // Convert to GenerationTimeSeries format for compatibility
                // Use one record per day (simulation aggregates back to daily anyway)
                const records: GenerationRecord[] = dailyGeneration.map((day) => ({
                    intervalStart: `${day.date}T00:00:00.000Z`,
                    intervalEnd: `${day.date}T23:59:59.999Z`,
                    generation: day.generationKwh,
                }));

                const generationData: GenerationTimeSeries = {
                    systemSizeKwp: params.systemConfig.systemSizeKwp,
                    performanceRatio: params.systemConfig.performanceRatio,
                    location: params.postcode,
                    periodStart: params.periodFrom,
                    periodEnd: params.periodTo,
                    records,
                };

                setData(generationData);
                return generationData;
            } catch (err) {
                if (err instanceof SolarDataError) {
                    setError(err.message);
                } else {
                    setError('An unexpected error occurred while generating solar data');
                }
                setData(null);
                return null;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setLoading(false);
    }, []);

    return { data, loading, error, generateData, reset };
}
