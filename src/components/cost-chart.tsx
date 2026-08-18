import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDaysInCalendarMonth } from '@/lib/utils';
import type { MonthlyFinancialSummary } from '@/types';
import { Info } from 'lucide-react';

interface CostChartProps {
    baseline: MonthlyFinancialSummary[];
    solarOnly?: MonthlyFinancialSummary[];
    batteryOnly?: MonthlyFinancialSummary[];
    withSolar: MonthlyFinancialSummary[];
    /** What the user actually spent on their real tariff */
    actualSpend?: MonthlyFinancialSummary[];
}

/**
 * The first/last month of a 12-month data window is usually partial (e.g. data
 * starting mid-month) - its raw net cost is naturally lower just because it
 * covers fewer days, which makes the chart dip misleadingly at the edges.
 * Scale it up to what a full calendar month would look like at the same rate.
 */
function extrapolateToFullMonth(month: MonthlyFinancialSummary | undefined): number | undefined {
    if (!month || month.daysInMonth <= 0) return month?.netCostPounds;
    const calendarDays = getDaysInCalendarMonth(month.month);
    if (month.daysInMonth >= calendarDays) return month.netCostPounds;
    return month.netCostPounds * (calendarDays / month.daysInMonth);
}

export function CostChart({ baseline, solarOnly, batteryOnly, withSolar, actualSpend }: CostChartProps) {
    const chartData = baseline.map((baselineMonth, index) => {
        const solarOnlyMonth = solarOnly?.[index];
        const batteryOnlyMonth = batteryOnly?.[index];
        const solarBatteryMonth = withSolar[index];
        const actualMonth = actualSpend?.[index];
        const calendarDays = getDaysInCalendarMonth(baselineMonth.month);
        const isPartial = baselineMonth.daysInMonth > 0 && baselineMonth.daysInMonth < calendarDays;
        return {
            month: formatMonth(baselineMonth.month),
            isPartial,
            actual: extrapolateToFullMonth(actualMonth),
            baseline: extrapolateToFullMonth(baselineMonth) ?? 0,
            solarOnly: extrapolateToFullMonth(solarOnlyMonth) ?? 0,
            batteryOnly: extrapolateToFullMonth(batteryOnlyMonth) ?? 0,
            withSolar: extrapolateToFullMonth(solarBatteryMonth) ?? 0,
        };
    });
    const hasPartialMonth = chartData.some((d) => d.isPartial);
    const partialMonthLabels = new Set(chartData.filter((d) => d.isPartial).map((d) => d.month));

    return (
        <Card>
            <CardHeader className="pb-2 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                        <CardTitle className="text-base sm:text-lg">Monthly Cost Breakdown</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            How your bills would compare month by month
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
                <div className="h-[250px] sm:h-[350px] -mx-2 sm:mx-0 min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                                tickFormatter={(value: string) => partialMonthLabels.has(value) ? `${value}*` : value}
                            />
                            <YAxis
                                tick={{ fontSize: 10 }}
                                tickFormatter={(value) => `£${value}`}
                                width={45}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null;
                                    const isPartial = partialMonthLabels.has(label as string);
                                    return (
                                        <div className="bg-white dark:bg-slate-800 p-2 sm:p-3 border rounded-lg shadow-lg text-xs sm:text-sm">
                                            <p className="font-semibold mb-1 sm:mb-2">{label}</p>
                                            {isPartial && (
                                                <p className="text-[10px] text-amber-600 mb-1.5">Partial month - scaled up to a full month</p>
                                            )}
                                            <div className="space-y-0.5 sm:space-y-1">
                                                {payload.map((entry) => (
                                                    <div key={entry.dataKey} className="flex items-center justify-between gap-3 sm:gap-4">
                                                        <span className="flex items-center gap-1 sm:gap-2">
                                                            <span
                                                                className="w-2 h-2 sm:w-3 sm:h-3 rounded"
                                                                style={{ backgroundColor: entry.color }}
                                                            />
                                                            {entry.name}
                                                        </span>
                                                        <span className="font-medium">£{typeof entry.value === 'number' ? entry.value.toFixed(0) : entry.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                            <Legend
                                wrapperStyle={{ fontSize: '10px' }}
                                formatter={(value: string) => (
                                    <span className="text-[10px] sm:text-xs">{value}</span>
                                )}
                            />
                            {actualSpend && (
                                <Line
                                    type="monotone"
                                    dataKey="actual"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    name="You Paid"
                                    dot={{ r: 3 }}
                                    strokeDasharray="5 5"
                                />
                            )}
                            <Line
                                type="monotone"
                                dataKey="baseline"
                                stroke="#94a3b8"
                                strokeWidth={2}
                                name="No Solar"
                                dot={{ r: 2 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="solarOnly"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                name="Solar Only"
                                dot={{ r: 2 }}
                            />
                            {batteryOnly && (
                                <Line
                                    type="monotone"
                                    dataKey="batteryOnly"
                                    stroke="#0ea5e9"
                                    strokeWidth={2}
                                    name="Battery Only"
                                    dot={{ r: 2 }}
                                />
                            )}
                            <Line
                                type="monotone"
                                dataKey="withSolar"
                                stroke="#10b981"
                                strokeWidth={2}
                                name="Solar + Battery"
                                dot={{ r: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Explanation */}
                <div className="flex items-start gap-2 p-2 sm:p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg text-xs sm:text-sm">
                    <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-blue-800 dark:text-blue-200">
                        <span className="hidden sm:inline">
                            {actualSpend && <><strong className="text-blue-600">Blue dashed</strong> = what you actually paid. </>}
                            <strong>Grey</strong> = without solar on selected tariff.{' '}
                            <strong className="text-amber-600">Amber</strong> = solar panels only.{' '}
                            {batteryOnly && <><strong className="text-sky-600">Sky blue</strong> = battery only, no solar. </>}
                            <strong className="text-emerald-600">Green</strong> = solar + battery.
                            {hasPartialMonth && <> <strong>*</strong> = partial month, scaled up to represent a full month.</>}
                        </span>
                        <span className="sm:hidden">
                            {actualSpend ? 'Blue = you paid. ' : ''}Green = with solar + battery
                            {hasPartialMonth && ' (* = partial month, scaled to full)'}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function formatMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year!), parseInt(month!) - 1);
    return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}
