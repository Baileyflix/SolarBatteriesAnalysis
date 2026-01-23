import { useState, useCallback } from 'react';
import type { ConsumptionTimeSeries } from '@/types';
import { OctopusEnergyClient, OctopusEnergyError } from '@/services/octopus-energy';

interface UseConsumptionDataResult {
    data: ConsumptionTimeSeries | null;
    loading: boolean;
    error: string | null;
    fetchData: (params: {
        apiKey: string;
        mpan: string;
        serialNumber: string;
        periodFrom: string;
        periodTo: string;
    }) => Promise<ConsumptionTimeSeries | null>;
    reset: () => void;
}

/**
 * Custom hook for fetching Octopus Energy consumption data
 */
export function useConsumptionData(): UseConsumptionDataResult {
    const [data, setData] = useState<ConsumptionTimeSeries | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(
        async (params: {
            apiKey: string;
            mpan: string;
            serialNumber: string;
            periodFrom: string;
            periodTo: string;
        }): Promise<ConsumptionTimeSeries | null> => {
            setLoading(true);
            setError(null);

            try {
                const client = new OctopusEnergyClient(params.apiKey);
                const result = await client.fetchConsumption({
                    ...params,
                    apiKey: params.apiKey,
                });

                setData(result);
                return result;
            } catch (err) {
                if (err instanceof OctopusEnergyError) {
                    setError(err.message);
                } else {
                    setError('An unexpected error occurred while fetching consumption data');
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

    return { data, loading, error, fetchData, reset };
}
