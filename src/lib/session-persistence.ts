import type { ConsumptionTimeSeries, GenerationTimeSeries, TariffConfig } from '@/types';
import type { ScenarioConfig } from '@/components/scenario-config-panel';

/**
 * Persists the connected session (API key, account, and fetched data) to
 * localStorage so reloading the app doesn't require re-entering the API key
 * and re-running account discovery. The API key is stored in plaintext -
 * anyone with local access to this browser profile could read it via
 * devtools, so this is only appropriate for a personal-use tool on a
 * trusted machine.
 */

const STORAGE_KEY = 'solar-calculator-preferences';
const STORAGE_VERSION = 1;

export interface PersistedSession {
    version: typeof STORAGE_VERSION;
    apiKey: string;
    accountNumber: string;
    mpan: string;
    serialNumber: string;
    postcode: string;
    dateRange: { from: string; to: string };
    consumption: ConsumptionTimeSeries | null;
    generation: GenerationTimeSeries | null;
    actualTariffConfig: TariffConfig | null;
    scenarioConfig: ScenarioConfig;
}

/**
 * Save the session. Falls back to dropping the bulky consumption/generation
 * time series (keeping credentials + config) if the full payload doesn't fit
 * in the browser's storage quota, so re-entering the API key is still avoided
 * even when a year of half-hourly data won't fit.
 */
export function saveSession(session: PersistedSession): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...session,
                consumption: null,
                generation: null,
            }));
        } catch (error) {
            // Storage unavailable entirely (e.g. private browsing) - degrade
            // gracefully, the app still works, it just won't survive a reload.
            console.warn('[SolarCalc] Failed to persist session:', error);
        }
    }
}

export function loadSession(): PersistedSession | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedSession;
        if (parsed.version !== STORAGE_VERSION) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
}
