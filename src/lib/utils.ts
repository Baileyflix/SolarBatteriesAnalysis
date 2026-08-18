import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format a "vs. reference" cost delta so a loss reads as extra cost rather
 * than a doubled-up negative savings figure (e.g. "−£-93" instead of "+£93 more").
 * Positive deltaPounds means cheaper than the reference (a saving); negative
 * means more expensive than the reference (a loss).
 */
export function formatCostDelta(deltaPounds: number): { text: string; className: string } {
    const rounded = Math.round(deltaPounds)
    if (rounded >= 0) {
        return { text: `−£${rounded}`, className: 'text-emerald-600' }
    }
    return { text: `+£${Math.abs(rounded)}`, className: 'text-red-600' }
}

/** Number of calendar days in a "YYYY-MM" month (e.g. 31 for "2025-07") */
export function getDaysInCalendarMonth(yearMonth: string): number {
    const [year, month] = yearMonth.split('-').map(Number)
    return new Date(year!, month!, 0).getDate()
}
