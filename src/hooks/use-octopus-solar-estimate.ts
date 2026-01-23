import { useState, useCallback } from 'react';
import { OctopusEnergyClient, type OctopusSolarEstimateSummary } from '@/services/octopus-energy';

interface UseOctopusSolarEstimateReturn {
    estimate: OctopusSolarEstimateSummary | null;
    loading: boolean;
    error: string | null;
    fetchEstimate: (apiKey: string, postcode: string) => Promise<OctopusSolarEstimateSummary | null>;
    reset: () => void;
}

/**
 * Hook to fetch Octopus Energy's solar generation estimate for a postcode
 * This provides an independent benchmark for expected solar output
 */
export function useOctopusSolarEstimate(): UseOctopusSolarEstimateReturn {
    const [estimate, setEstimate] = useState<OctopusSolarEstimateSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEstimate = useCallback(async (apiKey: string, postcode: string) => {
        setLoading(true);
        setError(null);

        try {
            const client = new OctopusEnergyClient(apiKey);
            const result = await client.fetchSolarEstimate(postcode);

            setEstimate(result);
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch Octopus solar estimate';
            // Don't set error state - this is optional data
            setEstimate(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setEstimate(null);
        setLoading(false);
        setError(null);
    }, []);

    return {
        estimate,
        loading,
        error,
        fetchEstimate,
        reset,
    };
}
