import { useEffect, useState } from 'react';
import { fetchLivePresetRates, resolveGspRegion, LIVE_TARIFF_PRESET_KEYS } from '@/services/octopus-live-rates';
import type { LivePresetRates } from '@/services/octopus-live-rates';
import type { UK_TARIFF_PRESETS } from '@/lib/cost-engine';

type PresetKey = keyof typeof UK_TARIFF_PRESETS;

export interface LiveTariffRatesState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    /** GSP region letter resolved from the postcode, e.g. "C" */
    region: string | null;
    /** Live rates keyed by preset, only present for presets with a resolvable Octopus product */
    rates: Partial<Record<PresetKey, LivePresetRates>>;
}

const IDLE_STATE: LiveTariffRatesState = { status: 'idle', region: null, rates: {} };

/**
 * Fetches live Octopus tariff rates for the GSP region a postcode falls in,
 * for the subset of UK_TARIFF_PRESETS that map onto real, currently-open
 * Octopus products (see PRESET_PRODUCT_SOURCES in octopus-live-rates.ts).
 * Presets with no live source (EDF, BG, OVO, Ofgem cap, etc.) are simply
 * absent from `rates` - callers should merge onto the static preset rather
 * than replace it.
 */
export function useLiveTariffRates(postcode: string): LiveTariffRatesState {
    const [state, setState] = useState<LiveTariffRatesState>(IDLE_STATE);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!postcode) {
                setState(IDLE_STATE);
                return;
            }

            setState(prev => ({ ...prev, status: 'loading' }));

            const region = await resolveGspRegion(postcode);
            if (cancelled) return;

            if (!region) {
                setState({ status: 'error', region: null, rates: {} });
                return;
            }

            const entries = await Promise.all(
                LIVE_TARIFF_PRESET_KEYS.map(async key => [key, await fetchLivePresetRates(key, region)] as const)
            );
            if (cancelled) return;

            const rates: Partial<Record<PresetKey, LivePresetRates>> = {};
            for (const [key, presetRates] of entries) {
                if (presetRates) rates[key] = presetRates;
            }

            setState({ status: 'ready', region, rates });
        })();

        return () => {
            cancelled = true;
        };
    }, [postcode]);

    return state;
}
