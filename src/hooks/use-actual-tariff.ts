import { useState, useCallback } from 'react';
import { OctopusEnergyClient } from '@/services/octopus-energy';
import type { ActualTariffInfo, TariffRatePeriod } from '@/types';

interface UseActualTariffState {
    loading: boolean;
    error: string | null;
    importTariff: ActualTariffInfo | null;
    exportTariff: ActualTariffInfo | null;
    lastFetched: Date | null;
}

interface UseActualTariffReturn extends UseActualTariffState {
    fetchTariff: (apiKey: string, accountNumber: string, dateRange?: { from: Date; to: Date }) => Promise<void>;
    fetchHalfHourlyRates: (periodFrom: Date, periodTo: Date) => Promise<TariffRatePeriod[]>;
    reset: () => void;
}

/**
 * Hook for fetching the user's actual tariff from Octopus Energy
 * Now supports fetching half-hourly rates for TOU tariffs
 */
export function useActualTariff(): UseActualTariffReturn {
    const [state, setState] = useState<UseActualTariffState>({
        loading: false,
        error: null,
        importTariff: null,
        exportTariff: null,
        lastFetched: null,
    });

    // Store client and tariff info for rate fetching
    const [clientRef, setClientRef] = useState<OctopusEnergyClient | null>(null);

    const fetchTariff = useCallback(async (apiKey: string, accountNumber: string, dateRange?: { from: Date; to: Date }) => {
        setState(prev => ({
            ...prev,
            loading: true,
            error: null,
        }));

        try {
            const client = new OctopusEnergyClient(apiKey);
            setClientRef(client);
            
            const result = await client.fetchActualTariff(accountNumber);

            if (!result) {
                setState({
                    loading: false,
                    error: 'Could not fetch tariff information. This may be a limitation of the API.',
                    importTariff: null,
                    exportTariff: null,
                    lastFetched: new Date(),
                });
                return;
            }

            let importTariff = result.import ?? null;
            
            // If we have a date range and a TOU tariff, fetch half-hourly rates
            if (importTariff && dateRange && importTariff.isVariable) {
                try {
                    const rates = await client.fetchHalfHourlyRates(
                        importTariff.productCode,
                        importTariff.tariffCode,
                        dateRange.from,
                        dateRange.to
                    );
                    
                    if (rates.length > 0) {
                        const analysis = OctopusEnergyClient.analyzeRates(rates);
                        importTariff = {
                            ...importTariff,
                            hasTimeOfUseRates: true,
                            offPeakRatePence: analysis.offPeak,
                            peakRatePence: analysis.peak,
                            unitRatePence: analysis.weighted, // Use weighted average as the "headline" rate
                            halfHourlyRates: rates,
                        };
                    }
                } catch (rateError) {
                    console.warn('[useActualTariff] Failed to fetch half-hourly rates:', rateError);
                    // Continue with basic tariff info
                }
            }

            setState({
                loading: false,
                error: null,
                importTariff,
                exportTariff: result.export ?? null,
                lastFetched: new Date(),
            });
        } catch (error) {
            let errorMessage = 'Failed to fetch tariff information';

            if (error instanceof Error) {
                errorMessage = error.message;
            }

            setState({
                loading: false,
                error: errorMessage,
                importTariff: null,
                exportTariff: null,
                lastFetched: null,
            });
        }
    }, []);

    const fetchHalfHourlyRates = useCallback(async (periodFrom: Date, periodTo: Date): Promise<TariffRatePeriod[]> => {
        if (!clientRef || !state.importTariff) {
            return [];
        }
        
        try {
            return await clientRef.fetchHalfHourlyRates(
                state.importTariff.productCode,
                state.importTariff.tariffCode,
                periodFrom,
                periodTo
            );
        } catch {
            return [];
        }
    }, [clientRef, state.importTariff]);

    const reset = useCallback(() => {
        setState({
            loading: false,
            error: null,
            importTariff: null,
            exportTariff: null,
            lastFetched: null,
        });
        setClientRef(null);
    }, []);

    return {
        ...state,
        fetchTariff,
        reset,
    };
}
