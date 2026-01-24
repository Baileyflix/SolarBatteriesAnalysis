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
import type { MonthlyFinancialSummary, ScenarioType } from '@/types';
import { Info, Battery, Sun, Zap } from 'lucide-react';

interface ResultsTableProps {
    monthlyData: MonthlyFinancialSummary[];
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
        case 'withSolar': return 'what each month\'s bill would have been with solar + battery';
    }
}

export function ResultsTable({ monthlyData, scenario = 'withSolar' }: ResultsTableProps) {
    const isBaseline = scenario === 'baseline';
    const badge = getScenarioBadge(scenario);
    
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
                                {!isBaseline && <TableHead className="text-right">Solar Generated</TableHead>}
                                <TableHead className="text-right">{isBaseline ? 'Grid Import' : 'Would Import'}</TableHead>
                                {!isBaseline && <TableHead className="text-right">Would Export</TableHead>}
                                <TableHead className="text-right">Import Cost</TableHead>
                                {!isBaseline && <TableHead className="text-right">Export Earned</TableHead>}
                                <TableHead className="text-right">Net Bill</TableHead>
                                {monthlyData[0]?.directDebitPounds !== undefined && (
                                    <>
                                        <TableHead className="text-right">Direct Debit</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                    </>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthlyData.map((month) => (
                                <TableRow key={month.month}>
                                    <TableCell className="font-medium">{formatMonth(month.month)}</TableCell>
                                    <TableCell className="text-right font-medium">{month.totalConsumptionKwh.toFixed(0)} kWh</TableCell>
                                    {!isBaseline && <TableCell className="text-right text-amber-700">{month.totalGenerationKwh.toFixed(0)} kWh</TableCell>}
                                    <TableCell className="text-right text-red-600">{month.gridImportKwh.toFixed(0)} kWh</TableCell>
                                    {!isBaseline && <TableCell className="text-right text-green-600">{month.gridExportKwh.toFixed(0)} kWh</TableCell>}
                                    <TableCell className="text-right text-red-600">£{month.importCostPounds.toFixed(2)}</TableCell>
                                    {!isBaseline && <TableCell className="text-right text-green-600">£{month.exportRevenuePounds.toFixed(2)}</TableCell>}
                                    <TableCell className="text-right font-semibold">£{month.netCostPounds.toFixed(2)}</TableCell>
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
                            ))}
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
                                All costs are based on the selected tariff.
                            </>
                        ) : (
                            <>
                                <strong>Your Usage</strong> is actual consumption from Octopus.{' '}
                                <strong>Solar Generated</strong> is simulated based on real weather.{' '}
                                <strong>Would Import/Export</strong> shows projected grid usage with your configured {scenario === 'withSolar' ? 'solar + battery' : 'solar'} system.
                            </>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function formatMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year!), parseInt(month!) - 1);
    return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
}
