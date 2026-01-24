import { useState, useEffect, useRef } from 'react';
import type { ScenarioConfig } from '@/components/scenario-config-panel';

/**
 * Hook to detect when scenario configuration has changed since last calculation.
 * 
 * Uses deep comparison to detect ALL config changes, including nested fields
 * that the previous implementation missed (e.g., performanceRatio, roundTripEfficiency).
 * 
 * @param currentConfig - The current scenario configuration
 * @param isConnected - Whether the app is connected to Octopus
 * @returns Object with hasChanged flag and markAsCalculated function
 */
export function useConfigChangeDetection(
    currentConfig: ScenarioConfig,
    isConnected: boolean
) {
    const [hasChanged, setHasChanged] = useState(false);
    const lastCalcConfigRef = useRef<ScenarioConfig | null>(null);

    // Deep comparison using JSON.stringify
    // This catches ALL field changes including nested ones
    useEffect(() => {
        if (!lastCalcConfigRef.current || !isConnected) {
            setHasChanged(false);
            return;
        }

        const currentJson = JSON.stringify(currentConfig);
        const lastJson = JSON.stringify(lastCalcConfigRef.current);

        setHasChanged(currentJson !== lastJson);
    }, [currentConfig, isConnected]);

    /**
     * Mark the current config as the last calculated config.
     * Call this after running a calculation.
     */
    const markAsCalculated = () => {
        // Deep clone to prevent reference issues
        lastCalcConfigRef.current = JSON.parse(JSON.stringify(currentConfig));
        setHasChanged(false);
    };

    /**
     * Reset the tracking state (e.g., on disconnect)
     */
    const reset = () => {
        lastCalcConfigRef.current = null;
        setHasChanged(false);
    };

    return {
        /** Whether config has changed since last calculation */
        hasChanged,
        /** Mark current config as calculated (call after runSimulation) */
        markAsCalculated,
        /** Reset tracking state (call on disconnect) */
        reset,
        /** Get the last calculated config (for debugging) */
        lastCalcConfig: lastCalcConfigRef.current,
    };
}

/**
 * Hook to detect when PV system config has changed (requires solar regeneration).
 * 
 * PV system changes require regenerating solar data from NASA POWER,
 * not just re-running the simulation.
 * 
 * @param pvSystem - Current PV system configuration
 * @param hasStoredGeneration - Whether we have stored generation data
 * @returns Object with needsRegeneration flag and markAsRegenerated function
 */
export function usePvSystemChangeDetection(
    pvSystem: { systemSizeKwp: number; performanceRatio: number },
    hasStoredGeneration: boolean
) {
    const [needsRegeneration, setNeedsRegeneration] = useState(false);
    const previousPvSystemRef = useRef<typeof pvSystem | null>(null);

    useEffect(() => {
        if (!previousPvSystemRef.current || !hasStoredGeneration) {
            previousPvSystemRef.current = pvSystem;
            return;
        }

        const prev = previousPvSystemRef.current;
        const hasChanged =
            prev.systemSizeKwp !== pvSystem.systemSizeKwp ||
            prev.performanceRatio !== pvSystem.performanceRatio;

        if (hasChanged) {
            setNeedsRegeneration(true);
        }

        previousPvSystemRef.current = pvSystem;
    }, [pvSystem, hasStoredGeneration]);

    /**
     * Mark regeneration as complete
     */
    const markAsRegenerated = () => {
        setNeedsRegeneration(false);
    };

    /**
     * Reset tracking state
     */
    const reset = () => {
        previousPvSystemRef.current = null;
        setNeedsRegeneration(false);
    };

    return {
        needsRegeneration,
        markAsRegenerated,
        reset,
    };
}
