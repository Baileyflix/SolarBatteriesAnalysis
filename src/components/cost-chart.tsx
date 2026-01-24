import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { MonthlyFinancialSummary } from '@/types';
import { Info } from 'lucide-react';

interface CostChartProps {
    baseline: MonthlyFinancialSummary[];
    solarOnly?: MonthlyFinancialSummary[];
    withSolar: MonthlyFinancialSummary[];
}

export function CostChart({ baseline, solarOnly, withSolar }: CostChartProps) {
    const chartData = baseline.map((baselineMonth, index) => {
        const solarOnlyMonth = solarOnly?.[index];
        const solarBatteryMonth = withSolar[index];
        return {
            month: formatMonth(baselineMonth.month),
            baseline: baselineMonth.netCostPounds,
            solarOnly: solarOnlyMonth?.netCostPounds ?? 0,
            withSolar: solarBatteryMonth?.netCostPounds ?? 0,
        };
    });

    // Calculate totals for summary
    const totalBaseline = baseline.reduce((sum, m) => sum + m.netCostPounds, 0);
    const totalSolarOnly = solarOnly?.reduce((sum, m) => sum + m.netCostPounds, 0) ?? 0;
    const totalWithSolar = withSolar.reduce((sum, m) => sum + m.netCostPounds, 0);
    const solarOnlySavings = totalBaseline - totalSolarOnly;
    const batterySavings = totalSolarOnly - totalWithSolar;
    const totalSavings = totalBaseline - totalWithSolar;

    return (
        <Card>
            <CardHeader className="pb-2 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                        <CardTitle className="text-base sm:text-lg">What Your Bills Would Have Been</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Monthly comparison based on your actual usage
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-2 sm:p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">No Solar</div>
                        <div className="text-sm sm:text-lg font-bold text-slate-600 dark:text-slate-400">£{Math.round(totalBaseline).toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Solar Only</div>
                        <div className="text-sm sm:text-lg font-bold text-amber-600">£{Math.round(totalSolarOnly).toLocaleString()}</div>
                        <div className="text-[10px] sm:text-xs text-emerald-600">-£{Math.round(solarOnlySavings)}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Solar + Battery</div>
                        <div className="text-sm sm:text-lg font-bold text-emerald-600">£{Math.round(totalWithSolar).toLocaleString()}</div>
                        <div className="text-[10px] sm:text-xs text-emerald-600">-£{Math.round(totalSavings)}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Battery Adds</div>
                        <div className="text-sm sm:text-lg font-bold text-blue-600">£{Math.round(batterySavings).toLocaleString()}</div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">extra savings</div>
                    </div>
                </div>

                <div className="h-[250px] sm:h-[350px] -mx-2 sm:mx-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis
                                tick={{ fontSize: 10 }}
                                tickFormatter={(value) => `£${value}`}
                                width={45}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null;
                                    return (
                                        <div className="bg-white dark:bg-slate-800 p-2 sm:p-3 border rounded-lg shadow-lg text-xs sm:text-sm">
                                            <p className="font-semibold mb-1 sm:mb-2">{label}</p>
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
                            <strong>No Solar</strong> = your bills based on actual usage.{' '}
                            <strong>Solar Only</strong> = with panels but no battery (excess is exported).{' '}
                            <strong>Solar + Battery</strong> = stores excess to use later. The gap between amber and green shows what the battery adds.
                        </span>
                        <span className="sm:hidden">
                            Gap between amber and green = battery value
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
