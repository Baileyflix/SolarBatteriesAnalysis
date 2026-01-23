import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import type { MonthlyFinancialSummary } from '@/types';
import { Info } from 'lucide-react';

interface ResultsTableProps {
    monthlyData: MonthlyFinancialSummary[];
}

export function ResultsTable({ monthlyData }: ResultsTableProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                        <CardTitle>Monthly Bill Breakdown</CardTitle>
                        <CardDescription>What each month's bill would have been with your solar setup</CardDescription>
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
                                <TableHead className="text-right">Solar Generated</TableHead>
                                <TableHead className="text-right">Grid Import</TableHead>
                                <TableHead className="text-right">Grid Export</TableHead>
                                <TableHead className="text-right">Import Cost</TableHead>
                                <TableHead className="text-right">Export Earned</TableHead>
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
                                    <TableCell className="text-right text-amber-700">{month.totalGenerationKwh.toFixed(0)} kWh</TableCell>
                                    <TableCell className="text-right text-red-600">{month.gridImportKwh.toFixed(0)} kWh</TableCell>
                                    <TableCell className="text-right text-green-600">{month.gridExportKwh.toFixed(0)} kWh</TableCell>
                                    <TableCell className="text-right text-red-600">£{month.importCostPounds.toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-green-600">£{month.exportRevenuePounds.toFixed(2)}</TableCell>
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
                        <strong>Consumption</strong> is your actual usage from Octopus. <strong>Generation</strong> is what your solar panels would have produced based on the real weather during this period. Other columns show what your bills would have been.
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
