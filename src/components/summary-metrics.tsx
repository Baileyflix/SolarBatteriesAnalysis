import { useState } from 'react';
import { Card, CardContent } from '../../@/components/ui/card';
import { formatCostDelta } from '@/lib/utils';
import type { ScenarioComparison, ROICalculation, AnnualFinancialSummary, ActualTariffInfo } from '@/types';
import { TrendingUp, PiggyBank, Sparkles, Battery, Sun } from 'lucide-react';

type PaybackBasis = 'solarOnly' | 'batteryOnly' | 'withSolar';

interface SummaryMetricsProps {
    baseline: AnnualFinancialSummary;
    withSolar: AnnualFinancialSummary;
    solarOnly?: AnnualFinancialSummary | null;
    /** Battery only (no solar), charged off-peak from the grid */
    batteryOnly?: AnnualFinancialSummary | null;
    /** Comparison/ROI for Solar + Battery, against the correct reference (actual spend when known) */
    withSolarComparison: ScenarioComparison | null;
    withSolarRoi: ROICalculation | null;
    solarOnlyComparison?: ScenarioComparison | null;
    solarOnlyRoi?: ROICalculation | null;
    batteryOnlyComparison?: ScenarioComparison | null;
    batteryOnlyRoi?: ROICalculation | null;
    /** The actual tariff info for display */
    actualTariff?: ActualTariffInfo | null;
    /** What the user actually spent (calculated from their real tariff) */
    actualSpend?: AnnualFinancialSummary | null;
}

const PAYBACK_BASIS_OPTIONS: { value: PaybackBasis; label: string; icon: typeof Sun }[] = [
    { value: 'solarOnly', label: 'Solar Only', icon: Sun },
    { value: 'batteryOnly', label: 'Battery Only', icon: Battery },
    { value: 'withSolar', label: 'Solar + Battery', icon: Battery },
];

/** Per-year framing of formatCostDelta, for the annual savings captions below */
function formatSavingsCaption(deltaPounds: number): { text: string; className: string } {
    const { text, className } = formatCostDelta(deltaPounds);
    return { text: deltaPounds >= 0 ? `${text}/yr` : `${text}/yr more`, className };
}

export function SummaryMetrics({
    baseline,
    withSolar,
    solarOnly,
    batteryOnly,
    withSolarComparison,
    withSolarRoi,
    solarOnlyComparison,
    solarOnlyRoi,
    batteryOnlyComparison,
    batteryOnlyRoi,
    actualTariff,
    actualSpend,
}: SummaryMetricsProps) {
    const [paybackBasis, setPaybackBasis] = useState<PaybackBasis>('withSolar');

    const showActualSpend = !!actualSpend && !isNaN(actualSpend.totalNetCostPounds);

    // Savings/ROI figures are precomputed by useSimulation against the correct
    // reference (actual spend when known, otherwise baseline on selected tariff) -
    // just pick which scenario's pair to display based on the basis selector.
    const byBasis: Record<PaybackBasis, { comparison: ScenarioComparison | null | undefined; roi: ROICalculation | null | undefined; available: boolean }> = {
        solarOnly: { comparison: solarOnlyComparison, roi: solarOnlyRoi, available: !!solarOnly },
        batteryOnly: { comparison: batteryOnlyComparison, roi: batteryOnlyRoi, available: !!batteryOnly },
        withSolar: { comparison: withSolarComparison, roi: withSolarRoi, available: true },
    };
    const activeComparison = byBasis[paybackBasis].comparison;
    const activeRoi = byBasis[paybackBasis].roi;
    const activeSavings = activeComparison?.annualSavingsPounds ?? 0;
    const isLoss = activeSavings < 0;

    // Card-row savings captions - each measured against the same reference as the hero stats
    const solarOnlySavings = solarOnlyComparison?.annualSavingsPounds ?? 0;
    const batteryOnlySavings = batteryOnlyComparison?.annualSavingsPounds ?? 0;
    const withSolarSavings = withSolarComparison?.annualSavingsPounds ?? 0;
    const batteryExtraSavings = solarOnly ? solarOnly.totalNetCostPounds - withSolar.totalNetCostPounds : 0;

    return (
        <div className="space-y-4">
            {/* Payback basis selector */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Payback basis:</span>
                <div className="flex rounded-lg border bg-muted p-1">
                    {PAYBACK_BASIS_OPTIONS.map(({ value, label, icon: Icon }) => {
                        const isAvailable = byBasis[value].available;
                        return (
                            <button
                                key={value}
                                disabled={!isAvailable}
                                onClick={() => setPaybackBasis(value)}
                                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${paybackBasis === value
                                        ? 'bg-background shadow-sm font-medium'
                                        : isAvailable
                                            ? 'hover:bg-background/50'
                                            : 'opacity-40 cursor-not-allowed'
                                    }`}
                            >
                                <Icon className="h-3 w-3" />
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Two Hero Stats */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2">
                {/* Annual Savings (or Extra Cost, if this basis is actually pricier than the reference) */}
                <Card className={isLoss
                    ? 'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950 dark:to-rose-900 border-red-200 dark:border-red-800'
                    : 'bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 border-emerald-200 dark:border-emerald-800'
                }>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs sm:text-sm font-medium ${isLoss ? 'text-red-800 dark:text-red-200' : 'text-emerald-800 dark:text-emerald-200'}`}>
                                {isLoss ? 'Costs More' : showActualSpend ? 'You Could Save' : 'Annual Savings'}
                            </span>
                            <div className={`p-1.5 rounded-lg ${isLoss ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                                <PiggyBank className={`h-4 w-4 ${isLoss ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                            </div>
                        </div>
                        <div className={`text-3xl sm:text-4xl font-bold ${isLoss ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                            {isLoss ? '-' : ''}£{Math.abs(Math.round(activeSavings)).toLocaleString()}
                        </div>
                        <p className={`text-xs sm:text-sm mt-1 ${isLoss ? 'text-red-600/80 dark:text-red-400/80' : 'text-emerald-600/80 dark:text-emerald-400/80'}`}>
                            {Math.abs(activeComparison?.savingsPercentage ?? 0).toFixed(0)}% {isLoss ? 'increase' : 'reduction'} per year
                        </p>
                    </CardContent>
                </Card>

                {/* Payback Period */}
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200">Simple Payback</span>
                            <div className="p-1.5 bg-blue-500/20 rounded-lg">
                                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <div className="text-3xl sm:text-4xl font-bold text-blue-700 dark:text-blue-300">
                            {activeRoi && isFinite(activeRoi.paybackYears) ? `${activeRoi.paybackYears.toFixed(1)}` : 'N/A'}
                            {activeRoi && isFinite(activeRoi.paybackYears) && <span className="text-lg sm:text-xl font-normal ml-1">yrs</span>}
                        </div>
                        <p className="text-xs sm:text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                            {activeRoi ? `${PAYBACK_BASIS_OPTIONS.find(o => o.value === paybackBasis)?.label} cost: £${activeRoi.netSystemCostPounds.toLocaleString()}` : 'Enter system cost'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Cost Comparison with clear savings breakdown */}
            <Card>
                <CardContent className="p-4 sm:p-6">
                    {/* Main comparison row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                        {/* Your Actual Spend (if available and different tariff) */}
                        {showActualSpend && (
                            <div className="flex-1 text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border-2 border-blue-300 dark:border-blue-700">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    <span className="text-[10px] sm:text-xs font-medium text-blue-700 dark:text-blue-300">You Paid</span>
                                </div>
                                <div className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300">
                                    £{Math.round(actualSpend!.totalNetCostPounds).toLocaleString()}
                                </div>
                                <div className="text-[9px] sm:text-[10px] text-blue-600/70 truncate">
                                    {actualTariff?.displayName}
                                </div>
                            </div>
                        )}

                        {/* Without Solar */}
                        <div className="flex-1 text-center p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">Without Solar</div>
                            <div className="text-lg sm:text-xl font-bold text-slate-600 dark:text-slate-400">
                                £{Math.round(baseline.totalNetCostPounds).toLocaleString()}
                            </div>
                            {showActualSpend && (
                                <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                                    on selected tariff
                                </div>
                            )}
                        </div>

                        {/* Arrow */}
                        <div className="hidden sm:flex items-center text-emerald-500 text-2xl font-bold">→</div>
                        <div className="sm:hidden text-center text-emerald-500 text-lg font-bold">↓</div>

                        {/* Battery Only (if it meaningfully beats no solar/battery at all) */}
                        {batteryOnly && Math.abs(baseline.totalNetCostPounds - batteryOnly.totalNetCostPounds) > 10 && (
                            <>
                                <div className="flex-1 text-center p-3 rounded-lg bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800">
                                    <div className="text-[10px] sm:text-xs text-sky-700 dark:text-sky-300 mb-1">Battery Only</div>
                                    <div className="text-lg sm:text-xl font-bold text-sky-600 dark:text-sky-400">
                                        £{Math.round(batteryOnly.totalNetCostPounds).toLocaleString()}
                                    </div>
                                    <div className={`text-[9px] sm:text-[10px] font-medium ${formatSavingsCaption(batteryOnlySavings).className}`}>
                                        {formatSavingsCaption(batteryOnlySavings).text}
                                    </div>
                                </div>
                                <div className="hidden sm:flex items-center text-emerald-500 text-2xl font-bold">→</div>
                                <div className="sm:hidden text-center text-emerald-500 text-lg font-bold">↓</div>
                            </>
                        )}

                        {/* Solar Only (if different from with battery) */}
                        {solarOnly && Math.abs(solarOnly.totalNetCostPounds - withSolar.totalNetCostPounds) > 10 && (
                            <>
                                <div className="flex-1 text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                                    <div className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-300 mb-1">Solar Only</div>
                                    <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
                                        £{Math.round(solarOnly.totalNetCostPounds).toLocaleString()}
                                    </div>
                                    <div className={`text-[9px] sm:text-[10px] font-medium ${formatSavingsCaption(solarOnlySavings).className}`}>
                                        {formatSavingsCaption(solarOnlySavings).text}
                                    </div>
                                </div>
                                <div className="hidden sm:flex items-center text-emerald-500 text-2xl font-bold">→</div>
                                <div className="sm:hidden text-center text-emerald-500 text-lg font-bold">↓</div>
                            </>
                        )}

                        {/* With Solar + Battery */}
                        <div className="flex-1 text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-300 dark:border-emerald-700">
                            <div className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-300 mb-1">Solar + Battery</div>
                            <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                £{Math.round(withSolar.totalNetCostPounds).toLocaleString()}
                            </div>
                            <div className={`text-[9px] sm:text-[10px] font-medium ${formatSavingsCaption(withSolarSavings).className}`}>
                                {formatSavingsCaption(withSolarSavings).text}
                            </div>
                        </div>
                    </div>

                    {/* Battery value callout */}
                    {solarOnly && batteryExtraSavings > 10 && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-center gap-2 text-sm">
                                <Battery className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-muted-foreground">Battery adds</span>
                                <span className="font-bold text-purple-600 dark:text-purple-400">
                                    £{Math.round(batteryExtraSavings)}/yr
                                </span>
                                <span className="text-muted-foreground">extra savings</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
