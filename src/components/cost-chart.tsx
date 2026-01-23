import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import { Badge } from '../../@/components/ui/badge';
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
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                        <CardTitle>What Your Bills Would Have Been</CardTitle>
                        <CardDescription>
                            Monthly comparison based on your actual usage and real weather data
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">No Solar</div>
                        <div className="text-lg font-bold text-slate-600">£{Math.round(totalBaseline).toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">Solar Only</div>
                        <div className="text-lg font-bold text-amber-600">£{Math.round(totalSolarOnly).toLocaleString()}</div>
                        <div className="text-xs text-emerald-600">-£{Math.round(solarOnlySavings)}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">Solar + Battery</div>
                        <div className="text-lg font-bold text-emerald-600">£{Math.round(totalWithSolar).toLocaleString()}</div>
                        <div className="text-xs text-emerald-600">-£{Math.round(totalSavings)}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">Battery Adds</div>
                        <div className="text-lg font-bold text-blue-600">£{Math.round(batterySavings).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">extra savings</div>
                    </div>
                </div>

                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis
                            label={{ value: 'Cost (£)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                            tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                    <div className="bg-white dark:bg-slate-800 p-3 border rounded-lg shadow-lg">
                                        <p className="font-semibold mb-2">{label}</p>
                                        <div className="space-y-1 text-sm">
                                            {payload.map((entry) => (
                                                <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                                                    <span className="flex items-center gap-2">
                                                        <span
                                                            className="w-3 h-3 rounded"
                                                            style={{ backgroundColor: entry.color }}
                                                        />
                                                        {entry.name}
                                                    </span>
                                                    <span className="font-medium">£{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        <Legend
                            formatter={(value: string) => (
                                <span className="text-sm">{value}</span>
                            )}
                        />
                        <Line
                            type="monotone"
                            dataKey="baseline"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            name="No Solar"
                            dot={{ r: 4 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="solarOnly"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            name="Solar Only"
                            dot={{ r: 4 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="withSolar"
                            stroke="#10b981"
                            strokeWidth={2}
                            name="Solar + Battery"
                            dot={{ r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>

                {/* Explanation */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg text-sm">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-blue-800 dark:text-blue-200">
                        <strong>No Solar</strong> = your bills based on actual usage.{' '}
                        <strong>Solar Only</strong> = with panels but no battery (excess is exported).{' '}
                        <strong>Solar + Battery</strong> = stores excess to use later. The gap between amber and green shows what the battery adds.
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
