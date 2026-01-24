import { Card, CardContent } from '../../@/components/ui/card';
import type { ScenarioComparison, ROICalculation, AnnualFinancialSummary, ActualTariffInfo } from '@/types';
import { TrendingUp, PiggyBank, Sparkles, Battery } from 'lucide-react';

interface SummaryMetricsProps {
    comparison: ScenarioComparison;
    roi: ROICalculation | null;
    solarOnly?: AnnualFinancialSummary | null;
    /** Whether using the user's actual tariff for calculations */
    usingActualTariff?: boolean;
    /** The actual tariff info for display */
    actualTariff?: ActualTariffInfo | null;
    /** What the user actually spent (calculated from their real tariff) */
    actualSpend?: AnnualFinancialSummary | null;
}

export function SummaryMetrics({ comparison, roi, solarOnly, usingActualTariff, actualTariff, actualSpend }: SummaryMetricsProps) {
    const { baseline, withSolar, savingsPercentage } = comparison;

    // Debug logging
    console.log('[SummaryMetrics] Props:', {
        usingActualTariff,
        actualTariff: actualTariff?.displayName,
        actualSpendTotal: actualSpend?.totalNetCostPounds,
        baselineTotal: baseline.totalNetCostPounds,
    });

    // Determine the reference point for savings calculation
    const hasValidActualSpend = actualSpend && !isNaN(actualSpend.totalNetCostPounds);
    const showActualSpend = hasValidActualSpend && !usingActualTariff;
    
    console.log('[SummaryMetrics] Decision:', { hasValidActualSpend, showActualSpend });
    
    // Calculate savings vs actual spend if available, otherwise vs baseline
    const savingsVsReference = showActualSpend 
        ? actualSpend!.totalNetCostPounds - withSolar.totalNetCostPounds
        : baseline.totalNetCostPounds - withSolar.totalNetCostPounds;

    // Calculate breakdown of savings
    const solarOnlySavings = solarOnly ? baseline.totalNetCostPounds - solarOnly.totalNetCostPounds : 0;
    const batterySavings = solarOnly ? solarOnly.totalNetCostPounds - withSolar.totalNetCostPounds : 0;

    return (
        <div className="space-y-4">
            {/* Two Hero Stats */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2">
                {/* Annual Savings */}
                <Card className="bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 border-emerald-200 dark:border-emerald-800">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                {showActualSpend ? 'You Could Save' : 'Annual Savings'}
                            </span>
                            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                                <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                        <div className="text-3xl sm:text-4xl font-bold text-emerald-700 dark:text-emerald-300">
                            £{Math.round(savingsVsReference).toLocaleString()}
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                            {savingsPercentage.toFixed(0)}% reduction per year
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
                            {roi && isFinite(roi.paybackYears) ? `${roi.paybackYears.toFixed(1)}` : 'N/A'}
                            {roi && isFinite(roi.paybackYears) && <span className="text-lg sm:text-xl font-normal ml-1">yrs</span>}
                        </div>
                        <p className="text-xs sm:text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                            {roi ? `System cost: £${roi.netSystemCostPounds.toLocaleString()}` : 'Enter system cost'}
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

                        {/* Solar Only (if different from with battery) */}
                        {solarOnly && Math.abs(solarOnly.totalNetCostPounds - withSolar.totalNetCostPounds) > 10 && (
                            <>
                                <div className="flex-1 text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                                    <div className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-300 mb-1">Solar Only</div>
                                    <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
                                        £{Math.round(solarOnly.totalNetCostPounds).toLocaleString()}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] text-emerald-600 font-medium">
                                        −£{Math.round(solarOnlySavings)}/yr
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
                            <div className="text-[9px] sm:text-[10px] text-emerald-600 font-medium">
                                −£{Math.round(savingsVsReference)}/yr
                            </div>
                        </div>
                    </div>

                    {/* Battery value callout */}
                    {solarOnly && batterySavings > 10 && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-center gap-2 text-sm">
                                <Battery className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-muted-foreground">Battery adds</span>
                                <span className="font-bold text-purple-600 dark:text-purple-400">
                                    £{Math.round(batterySavings)}/yr
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
