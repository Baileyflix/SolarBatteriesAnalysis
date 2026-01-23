import { useState, useCallback } from 'react';
import { OctopusEnergyClient, OctopusEnergyError } from '@/services/octopus-energy';
import type { DiscoveredMeter, AccountDiscoveryResult } from '@/services/octopus-energy';

export type { DiscoveredMeter };

interface UseAccountDiscoveryState {
    loading: boolean;
    error: string | null;
    accounts: AccountDiscoveryResult['accounts'] | null;
    meters: DiscoveredMeter[] | null;
    isAuthenticated: boolean;
}

interface UseAccountDiscoveryReturn extends UseAccountDiscoveryState {
    discoverAccount: (apiKey: string) => Promise<void>;
    reset: () => void;
}

/**
 * Hook for discovering Octopus Energy account details
 * Authenticates with API key and fetches all meters
 */
export function useAccountDiscovery(): UseAccountDiscoveryReturn {
    const [state, setState] = useState<UseAccountDiscoveryState>({
        loading: false,
        error: null,
        accounts: null,
        meters: null,
        isAuthenticated: false,
    });

    const discoverAccount = useCallback(async (apiKey: string) => {
        setState(prev => ({
            ...prev,
            loading: true,
            error: null,
        }));

        try {
            const client = new OctopusEnergyClient(apiKey);
            const result = await client.discoverAccounts();

            if (result.meters.length === 0) {
                setState({
                    loading: false,
                    error: 'No electricity meters found on your account. Please ensure you have a smart meter.',
                    accounts: result.accounts,
                    meters: [],
                    isAuthenticated: true,
                });
                return;
            }

            setState({
                loading: false,
                error: null,
                accounts: result.accounts,
                meters: result.meters,
                isAuthenticated: true,
            });
        } catch (error) {
            let errorMessage = 'Failed to discover account details';

            if (error instanceof OctopusEnergyError) {
                errorMessage = error.message;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            setState({
                loading: false,
                error: errorMessage,
                accounts: null,
                meters: null,
                isAuthenticated: false,
            });
        }
    }, []);

    const reset = useCallback(() => {
        setState({
            loading: false,
            error: null,
            accounts: null,
            meters: null,
            isAuthenticated: false,
        });
    }, []);

    return {
        ...state,
        discoverAccount,
        reset,
    };
}
