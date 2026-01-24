import { Card, CardContent, CardHeader, CardTitle } from '../../@/components/ui/card';
import type { ScenarioComparison, ROICalculation, AnnualFinancialSummary } from '@/types';
import type { OctopusSolarEstimateSummary } from '@/services/octopus-energy';
import { TrendingUp, Zap, Battery, ArrowDownToLine, ArrowUpFromLine, PiggyBank, Sun, Info } from 'lucide-react';

interface SummaryMetricsProps {
    comparison: ScenarioComparison;
    roi: ROICalculation | null;
    octopusEstimate?: OctopusSolarEstimateSummary | null;
    pvSystemSizeKwp?: number;
    solarOnly?: AnnualFinancialSummary | null;
}

export function SummaryMetrics({ comparison, roi, octopusEstimate, pvSystemSizeKwp, solarOnly }: SummaryMetricsProps) {
    const { baseline, withSolar, annualSavingsPounds, savingsPercentage, selfConsumptionRate, selfSufficiencyRate } = comparison;

    // Scale Octopus estimate based on system size (Octopus estimate is for "average" ~4kWp system)
    const OCTOPUS_AVERAGE_SYSTEM_SIZE = 4; // kWp - typical UK domestic
    const scaledOctopusEstimate = octopusEstimate && pvSystemSizeKwp
        ? (octopusEstimate.annualEstimateKwh * (pvSystemSizeKwp / OCTOPUS_AVERAGE_SYSTEM_SIZE))
        : null;

    return (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Annual Savings - Hero Card */}
            <Card className="bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 border-emerald-200 dark:border-emerald-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-200">Annual Savings</CardTitle>
                    <div className="p-1 sm:p-1.5 bg-emerald-500/20 rounded-lg">
                        <PiggyBank className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-300">£{annualSavingsPounds.toFixed(0)}</div>
                    <p className="text-[10px] sm:text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 sm:mt-1">
                        {savingsPercentage.toFixed(0)}% reduction
                    </p>
                </CardContent>
            </Card>

            {/* Payback Period */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 border-blue-200 dark:border-blue-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200">Simple Payback</CardTitle>
                    <div className="p-1 sm:p-1.5 bg-blue-500/20 rounded-lg">
                        <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-300">
                        {roi && isFinite(roi.paybackYears) ? `${roi.paybackYears.toFixed(1)}` : 'N/A'}
                        {roi && isFinite(roi.paybackYears) && <span className="text-sm sm:text-lg font-normal ml-1">yrs</span>}
                    </div>
                    <p className="text-[10px] sm:text-xs text-blue-600/80 dark:text-blue-400/80 mt-0.5 sm:mt-1 truncate">
                        {roi ? `Cost: £${roi.netSystemCostPounds.toLocaleString()}` : 'Enter cost'}
                    </p>
                </CardContent>
            </Card>

            {/* Self-Consumption */}
            <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900 border-amber-200 dark:border-amber-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-200">Self-Consumption</CardTitle>
                    <div className="p-1 sm:p-1.5 bg-amber-500/20 rounded-lg">
                        <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-amber-700 dark:text-amber-300">{selfConsumptionRate.toFixed(0)}%</div>
                    <p className="text-[10px] sm:text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5 sm:mt-1">
                        Solar used at home
                    </p>
                </CardContent>
            </Card>

            {/* Self-Sufficiency */}
            <Card className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950 dark:to-violet-900 border-purple-200 dark:border-purple-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-purple-800 dark:text-purple-200">Self-Sufficiency</CardTitle>
                    <div className="p-1 sm:p-1.5 bg-purple-500/20 rounded-lg">
                        <Battery className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-300">{selfSufficiencyRate.toFixed(0)}%</div>
                    <p className="text-[10px] sm:text-xs text-purple-600/80 dark:text-purple-400/80 mt-0.5 sm:mt-1">
                        Covered by solar
                    </p>
                </CardContent>
            </Card>

            {/* Annual Costs Comparison */}
            <Card className="col-span-2 lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium">Annual Costs Comparison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-6 pt-0">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                        <span className="text-xs sm:text-sm text-muted-foreground">Baseline (no solar):</span>
                        <span className="font-semibold text-base sm:text-lg">£{baseline.totalNetCostPounds.toFixed(0)}</span>
                    </div>
                    {solarOnly && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 truncate">Solar only:</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <span className="font-semibold text-base sm:text-lg text-amber-600 dark:text-amber-400">£{solarOnly.totalNetCostPounds.toFixed(0)}</span>
                                <div className="text-[10px] sm:text-xs text-amber-600/70 dark:text-amber-400/70">
                                    -£{(baseline.totalNetCostPounds - solarOnly.totalNetCostPounds).toFixed(0)}/yr
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <Battery className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 truncate">Solar + battery:</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <span className="font-semibold text-base sm:text-lg text-emerald-600 dark:text-emerald-400">£{withSolar.totalNetCostPounds.toFixed(0)}</span>
                            <div className="text-[10px] sm:text-xs text-emerald-600/70 dark:text-emerald-400/70">
                                -£{(baseline.totalNetCostPounds - withSolar.totalNetCostPounds).toFixed(0)}/yr
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Energy Flows */}
            <Card className="col-span-2 lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium">Energy Flows (Annual)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-1.5 sm:gap-2 p-3 sm:p-6 pt-0">
                    <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                            <span className="text-xs sm:text-sm">Solar:</span>
                        </div>
                        <div className="text-right">
                            <span className="font-semibold text-xs sm:text-sm text-amber-600 dark:text-amber-400">{withSolar.totalGenerationKwh.toFixed(0)} kWh</span>
                            {scaledOctopusEstimate && (
                                <div className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1 justify-end">
                                    <Info className="h-3 w-3" />
                                    Est: {scaledOctopusEstimate.toFixed(0)} kWh
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Battery className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" />
                            <span className="text-xs sm:text-sm">Usage:</span>
                        </div>
                        <span className="font-semibold text-xs sm:text-sm">{baseline.totalConsumptionKwh.toFixed(0)} kWh</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <ArrowDownToLine className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                            <span className="text-xs sm:text-sm">Import:</span>
                        </div>
                        <span className="font-semibold text-xs sm:text-sm text-blue-600 dark:text-blue-400">{withSolar.totalImportKwh.toFixed(0)} kWh</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-green-50 dark:bg-green-950/50">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <ArrowUpFromLine className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                            <span className="text-xs sm:text-sm">Export:</span>
                        </div>
                        <span className="font-semibold text-xs sm:text-sm text-green-600 dark:text-green-400">{withSolar.totalExportKwh.toFixed(0)} kWh</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
