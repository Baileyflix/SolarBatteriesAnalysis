import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import { Badge } from '../../@/components/ui/badge';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import type { MonthlyFinancialSummary } from '@/types';
import { Info, Battery, Sun } from 'lucide-react';

interface EnergyFlowChartProps {
    monthlyData: MonthlyFinancialSummary[];
    scenario?: 'solarOnly' | 'withSolar';
}

export function EnergyFlowChart({ monthlyData, scenario = 'withSolar' }: EnergyFlowChartProps) {
    const chartData = monthlyData.map((month) => ({
        month: formatMonth(month.month),
        fullMonth: month.month,
        consumption: Math.round(month.totalConsumptionKwh),
        generation: Math.round(month.totalGenerationKwh),
        selfConsumed: Math.round(Math.min(month.totalGenerationKwh, month.totalConsumptionKwh) - month.gridExportKwh),
        gridImport: Math.round(month.gridImportKwh),
        gridExport: Math.round(month.gridExportKwh),
    }));

    // Calculate totals for summary
    const totalConsumption = monthlyData.reduce((sum, m) => sum + m.totalConsumptionKwh, 0);
    const totalGeneration = monthlyData.reduce((sum, m) => sum + m.totalGenerationKwh, 0);
    const totalGridImport = monthlyData.reduce((sum, m) => sum + m.gridImportKwh, 0);
    const totalGridExport = monthlyData.reduce((sum, m) => sum + m.gridExportKwh, 0);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <CardTitle>Energy Flow Analysis</CardTitle>
                            <Badge variant="outline" className={scenario === 'withSolar'
                                ? "text-emerald-700 bg-emerald-50 border-emerald-300"
                                : "text-amber-700 bg-amber-50 border-amber-300"
                            }>
                                {scenario === 'withSolar' ? (
                                    <><Battery className="h-3 w-3 mr-1" />Solar + Battery</>
                                ) : (
                                    <><Sun className="h-3 w-3 mr-1" />Solar Only</>
                                )}
                            </Badge>
                        </div>
                        <CardDescription>
                            Your actual usage vs simulated solar generation (based on real weather)
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="secondary" className="text-slate-700 bg-slate-100 border-slate-300">
                            <span className="w-2 h-2 rounded-full bg-slate-500 mr-1.5" />
                            Your Usage
                        </Badge>
                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300">
                            <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
                            Solar Generation
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">Your Usage</div>
                        <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{Math.round(totalConsumption).toLocaleString()} kWh</div>
                        <div className="text-[10px] text-muted-foreground">actual from Octopus</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">Solar Generated</div>
                        <div className="text-lg font-bold text-amber-600">{Math.round(totalGeneration).toLocaleString()} kWh</div>
                        <div className="text-[10px] text-muted-foreground">simulated</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">Would Import</div>
                        <div className="text-lg font-bold text-red-600">{Math.round(totalGridImport).toLocaleString()} kWh</div>
                        <div className="text-[10px] text-muted-foreground">{scenario === 'withSolar' ? 'with solar + battery' : 'with solar only'}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">Would Export</div>
                        <div className="text-lg font-bold text-green-600">{Math.round(totalGridExport).toLocaleString()} kWh</div>
                        <div className="text-[10px] text-muted-foreground">{scenario === 'withSolar' ? 'with solar + battery' : 'with solar only'}</div>
                    </div>
                </div>

                {/* Chart */}
                <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <pattern id="consumptionPattern" patternUnits="userSpaceOnUse" width="4" height="4">
                                <rect width="4" height="4" fill="#64748b" />
                            </pattern>
                            <pattern id="generationPattern" patternUnits="userSpaceOnUse" width="6" height="6">
                                <rect width="6" height="6" fill="#fbbf24" fillOpacity="0.3" />
                                <line x1="0" y1="6" x2="6" y2="0" stroke="#f59e0b" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis
                            label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 12 } }}
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
                                                        {entry.dataKey === 'consumption' && (
                                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">Actual</Badge>
                                                        )}
                                                        {entry.dataKey !== 'consumption' && (
                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-amber-700 border-amber-300 bg-amber-50">Est.</Badge>
                                                        )}
                                                    </span>
                                                    <span className="font-medium">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value} kWh</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        <Legend
                            formatter={(value: string) => {
                                if (value === 'Consumption') return <span>{value} <span className="text-xs text-muted-foreground">(actual)</span></span>;
                                return <span>{value} <span className="text-xs text-amber-600">(simulated)</span></span>;
                            }}
                        />
                        <ReferenceLine y={0} stroke="#000" />
                        <Area
                            type="monotone"
                            dataKey="consumption"
                            name="Consumption"
                            stroke="#475569"
                            fill="#94a3b8"
                            fillOpacity={0.6}
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="generation"
                            name="Generation"
                            stroke="#f59e0b"
                            fill="#fcd34d"
                            fillOpacity={0.4}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                        />
                    </AreaChart>
                </ResponsiveContainer>

                {/* Legend Explanation */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg text-sm">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-blue-800 dark:text-blue-200">
                        <strong>Consumption</strong> is your actual usage from Octopus Energy for this period.{' '}
                        <strong>Generation</strong> shows what your solar panels would have produced based on the <em>actual weather</em> during this same period.
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
