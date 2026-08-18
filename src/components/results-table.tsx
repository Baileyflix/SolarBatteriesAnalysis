import { Fragment, useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import { Badge } from '../../@/components/ui/badge';
import { formatCostDelta } from '@/lib/utils';
import type { DailyCostBreakdown, MonthlyFinancialSummary, ScenarioType } from '@/types';
import { Info, Battery, Sun, Zap, ChevronDown, ChevronRight } from 'lucide-react';

interface ResultsTableProps {
    monthlyData: MonthlyFinancialSummary[];
    /** Day-by-day cost breakdown - if provided, months become expandable to show daily detail */
    dailyBreakdown?: DailyCostBreakdown[];
    /** Your actual historical monthly bills, on your real tariff - if provided, adds a "vs Your Tariff" column */
    actualSpendMonthly?: MonthlyFinancialSummary[];
    scenario?: ScenarioType;
}

function getScenarioBadge(scenario: ScenarioType) {
    switch (scenario) {
        case 'baseline':
            return {
                className: "text-slate-700 bg-slate-100 border-slate-300",
                icon: <Zap className="h-3 w-3 mr-1" />,
                label: "No Solar"
            };
        case 'solarOnly':
            return {
                className: "text-amber-700 bg-amber-50 border-amber-300",
                icon: <Sun className="h-3 w-3 mr-1" />,
                label: "Solar Only"
            };
        case 'batteryOnly':
            return {
                className: "text-sky-700 bg-sky-50 border-sky-300",
                icon: <Battery className="h-3 w-3 mr-1" />,
                label: "Battery Only"
            };
        case 'withSolar':
            return {
                className: "text-emerald-700 bg-emerald-50 border-emerald-300",
                icon: <Battery className="h-3 w-3 mr-1" />,
                label: "Solar + Battery"
            };
    }
}

function getScenarioDescription(scenario: ScenarioType): string {
    switch (scenario) {
        case 'baseline': return 'what each month\'s bill would be without solar';
        case 'solarOnly': return 'what each month\'s bill would have been with solar panels only';
        case 'batteryOnly': return 'what each month\'s bill would have been with a battery charged off-peak, no solar';
        case 'withSolar': return 'what each month\'s bill would have been with solar + battery';
    }
}

export function ResultsTable({ monthlyData, dailyBreakdown, actualSpendMonthly, scenario = 'withSolar' }: ResultsTableProps) {
    const isBaseline = scenario === 'baseline';
    const hideGeneration = isBaseline || scenario === 'batteryOnly';
    const badge = getScenarioBadge(scenario);
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

    const actualSpendByMonth = new Map((actualSpendMonthly ?? []).map((m) => [m.month, m]));
    const hasVsTariffColumn = actualSpendByMonth.size > 0;

    const columnCount =
        5 + // Month, Usage, Import, Import Cost, Net Bill
        (!hideGeneration ? 1 : 0) +
        (!isBaseline ? 2 : 0) + // Would Export + Export Earned
        (hasVsTariffColumn ? 1 : 0) +
        (monthlyData[0]?.directDebitPounds !== undefined ? 2 : 0);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <CardTitle>Monthly Bill Breakdown</CardTitle>
                            <Badge variant="outline" className={badge.className}>
                                {badge.icon}{badge.label}
                            </Badge>
                        </div>
                        <CardDescription>
                            {getScenarioDescription(scenario)}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="relative overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead className="text-right">Your Usage</TableHead>
                                {!hideGeneration && <TableHead className="text-right">Solar Generated</TableHead>}
                                <TableHead className="text-right">{isBaseline ? 'Grid Import' : 'Would Import'}</TableHead>
                                {!isBaseline && <TableHead className="text-right">Would Export</TableHead>}
                                <TableHead className="text-right">Import Cost</TableHead>
                                {!isBaseline && <TableHead className="text-right">Export Earned</TableHead>}
                                <TableHead className="text-right">Net Bill</TableHead>
                                {hasVsTariffColumn && (
                                    <TableHead className="text-right">vs Your Tariff</TableHead>
                                )}
                                {monthlyData[0]?.directDebitPounds !== undefined && (
                                    <>
                                        <TableHead className="text-right">Direct Debit</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                    </>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthlyData.map((month) => {
                                const daysInMonth = dailyBreakdown?.filter((d) => d.date.startsWith(month.month));
                                const isExpandable = !!daysInMonth && daysInMonth.length > 0;
                                const isExpanded = expandedMonth === month.month;

                                return (
                                    <Fragment key={month.month}>
                                        <TableRow
                                            className={isExpandable ? 'cursor-pointer' : undefined}
                                            onClick={isExpandable ? () => setExpandedMonth(isExpanded ? null : month.month) : undefined}
                                        >
                                            <TableCell className="font-medium">
                                                <span className="flex items-center gap-1">
                                                    {isExpandable && (
                                                        isExpanded
                                                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                    )}
                                                    {formatMonth(month.month)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{month.totalConsumptionKwh.toFixed(0)} kWh</TableCell>
                                            {!hideGeneration && <TableCell className="text-right text-amber-700">{month.totalGenerationKwh.toFixed(0)} kWh</TableCell>}
                                            <TableCell className="text-right text-red-600">{month.gridImportKwh.toFixed(0)} kWh</TableCell>
                                            {!isBaseline && <TableCell className="text-right text-green-600">{month.gridExportKwh.toFixed(0)} kWh</TableCell>}
                                            <TableCell className="text-right text-red-600">£{month.importCostPounds.toFixed(2)}</TableCell>
                                            {!isBaseline && <TableCell className="text-right text-green-600">£{month.exportRevenuePounds.toFixed(2)}</TableCell>}
                                            <TableCell className="text-right font-semibold">£{month.netCostPounds.toFixed(2)}</TableCell>
                                            {hasVsTariffColumn && (() => {
                                                const actualMonth = actualSpendByMonth.get(month.month);
                                                if (!actualMonth) return <TableCell className="text-right text-muted-foreground">-</TableCell>;
                                                const delta = formatCostDelta(actualMonth.netCostPounds - month.netCostPounds);
                                                return (
                                                    <TableCell className={`text-right font-medium ${delta.className}`}>
                                                        {delta.text}
                                                    </TableCell>
                                                );
                                            })()}
                                            {month.directDebitPounds !== undefined && (
                                                <>
                                                    <TableCell className="text-right">£{month.directDebitPounds.toFixed(2)}</TableCell>
                                                    <TableCell className={`text-right font-semibold ${(month.monthlyBalancePounds ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                                        }`}>
                                                        {month.monthlyBalancePounds !== undefined
                                                            ? `£${month.monthlyBalancePounds.toFixed(2)}`
                                                            : '-'}
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                        {isExpanded && daysInMonth && (
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell colSpan={columnCount} className="bg-muted/30 p-3">
                                                    <DailyBreakdownTable days={daysInMonth} />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {/* Explanation */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg text-sm">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-blue-800 dark:text-blue-200">
                        {isBaseline ? (
                            <>
                                <strong>Your Usage</strong> is actual consumption from Octopus.{' '}
                                <strong>Grid Import</strong> equals your usage (no solar generation).{' '}
                                All costs here are on the <strong>selected tariff</strong> in the config panel - not necessarily your real one.{' '}
                                {hasVsTariffColumn && <><strong>vs Your Tariff</strong> shows how this compares to what you actually paid.</>}
                            </>
                        ) : scenario === 'batteryOnly' ? (
                            <>
                                <strong>Your Usage</strong> is actual consumption from Octopus.{' '}
                                There's no solar in this scenario - the battery charges from the grid off-peak (if your tariff has a cheap overnight rate) and discharges to cover usage.{' '}
                                <strong>Would Export</strong> only appears if the tariff pays enough to sell leftover charge back at peak.{' '}
                                {hasVsTariffColumn && <><strong>vs Your Tariff</strong> shows how this compares to what you actually paid.</>}
                            </>
                        ) : (
                            <>
                                <strong>Your Usage</strong> is actual consumption from Octopus.{' '}
                                <strong>Solar Generated</strong> is simulated based on real weather.{' '}
                                <strong>Would Import/Export</strong> shows projected grid usage with your configured {scenario === 'withSolar' ? 'solar + battery' : 'solar'} system.{' '}
                                {hasVsTariffColumn && <><strong>vs Your Tariff</strong> shows how this compares to what you actually paid.</>}
                            </>
                        )}
                        {dailyBreakdown && dailyBreakdown.length > 0 && (
                            <> Click a month to see the day-by-day breakdown.</>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Every kWh of usage is met from exactly one of: solar (real-time), the
 * battery (discharged, regardless of whether it was charged overnight from
 * the grid or from spare daytime solar), or grid import at the standard rate.
 * offPeakChargeKwh is grid energy going *into* the battery, not straight to
 * load, so it deliberately isn't part of this breakdown.
 */
function getUsageSources(day: DailyCostBreakdown) {
    const selfConsumedSolarKwh = Math.min(day.generationKwh, day.consumptionKwh);
    const fromBatteryKwh = Math.max(0, day.consumptionKwh - day.regularImportKwh - selfConsumedSolarKwh);
    return { selfConsumedSolarKwh, fromBatteryKwh };
}

/** Day-by-day cost detail shown when a month row is expanded */
function DailyBreakdownTable({ days }: { days: DailyCostBreakdown[] }) {
    const hasOffPeakCharging = days.some((d) => d.offPeakChargeKwh > 0);
    const hasExport = days.some((d) => d.exportKwh > 0);
    const hasSelfConsumedSolar = days.some((d) => getUsageSources(d).selfConsumedSolarKwh > 0.05);
    const hasBatteryToLoad = days.some((d) => getUsageSources(d).fromBatteryKwh > 0.05);

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="h-8 text-xs">Day</TableHead>
                    <TableHead className="h-8 text-xs text-right">Usage</TableHead>
                    {hasSelfConsumedSolar && <TableHead className="h-8 text-xs text-right">Self-Consumed Solar</TableHead>}
                    {hasBatteryToLoad && <TableHead className="h-8 text-xs text-right">From Battery</TableHead>}
                    {hasOffPeakCharging && <TableHead className="h-8 text-xs text-right">Off-Peak Charge</TableHead>}
                    <TableHead className="h-8 text-xs text-right">Regular Import</TableHead>
                    {hasExport && <TableHead className="h-8 text-xs text-right">Export</TableHead>}
                    <TableHead className="h-8 text-xs text-right">Net Cost</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {days.map((day) => {
                    const { selfConsumedSolarKwh, fromBatteryKwh } = getUsageSources(day);
                    return (
                    <TableRow key={day.date} className="hover:bg-background/50">
                        <TableCell className="py-1.5 text-xs font-medium">{formatDay(day.date)}</TableCell>
                        <TableCell className="py-1.5 text-xs text-right">{day.consumptionKwh.toFixed(1)} kWh</TableCell>
                        {hasSelfConsumedSolar && (
                            <TableCell className="py-1.5 text-xs text-right text-amber-600">
                                {selfConsumedSolarKwh.toFixed(1)} kWh
                            </TableCell>
                        )}
                        {hasBatteryToLoad && (
                            <TableCell className="py-1.5 text-xs text-right text-sky-600">
                                {fromBatteryKwh.toFixed(1)} kWh
                            </TableCell>
                        )}
                        {hasOffPeakCharging && (
                            <TableCell className="py-1.5 text-xs text-right text-blue-600">
                                {day.offPeakChargeKwh.toFixed(1)} kWh
                                <span className="text-muted-foreground"> (£{day.offPeakChargeCostPounds.toFixed(2)})</span>
                            </TableCell>
                        )}
                        <TableCell className="py-1.5 text-xs text-right text-red-600">
                            {day.regularImportKwh.toFixed(1)} kWh
                            <span className="text-muted-foreground"> (£{day.regularImportCostPounds.toFixed(2)})</span>
                        </TableCell>
                        {hasExport && (
                            <TableCell className="py-1.5 text-xs text-right text-green-600">
                                {day.exportKwh.toFixed(1)} kWh
                                <span className="text-muted-foreground"> (£{day.exportRevenuePounds.toFixed(2)})</span>
                            </TableCell>
                        )}
                        <TableCell className="py-1.5 text-xs text-right font-semibold">£{day.netCostPounds.toFixed(2)}</TableCell>
                    </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

function formatMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year!), parseInt(month!) - 1);
    return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
}

function formatDay(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
