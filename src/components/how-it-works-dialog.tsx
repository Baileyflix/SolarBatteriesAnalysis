import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../../@/components/ui/dialog';
import { Button } from '../../@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../@/components/ui/tabs';
import { Info, Calculator, Sun, Battery, Zap, PiggyBank, ExternalLink } from 'lucide-react';

interface HowItWorksDialogProps {
    trigger?: React.ReactNode;
}

export function HowItWorksDialog({ trigger }: HowItWorksDialogProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" className="text-white/90 hover:text-white hover:bg-white/10">
                        <Info className="h-4 w-4 mr-1" />
                        How it works
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Calculator className="h-5 w-5 text-amber-500" />
                        How This Calculator Works
                    </DialogTitle>
                    <DialogDescription>
                        Transparent calculations using your real data and historical weather
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="overview" className="mt-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="formulas">Formulas</TabsTrigger>
                        <TabsTrigger value="sources">Data Sources</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4 mt-4">
                        <div className="space-y-4">
                            <div className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg">
                                <div className="p-2 bg-amber-500/20 rounded-lg h-fit">
                                    <Zap className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="font-medium">1. Your Actual Usage</h4>
                                    <p className="text-sm text-muted-foreground">
                                        We fetch your real half-hourly electricity consumption from Octopus Energy -
                                        typically 12 months of data to capture seasonal variations.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 p-3 bg-orange-50 dark:bg-orange-950/50 rounded-lg">
                                <div className="p-2 bg-orange-500/20 rounded-lg h-fit">
                                    <Sun className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <h4 className="font-medium">2. Historical Solar Data</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Using NASA POWER satellite data, we get actual solar irradiance for your
                                        location over the same period - not estimates, real measurements.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 p-3 bg-green-50 dark:bg-green-950/50 rounded-lg">
                                <div className="p-2 bg-green-500/20 rounded-lg h-fit">
                                    <Battery className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <h4 className="font-medium">3. Energy Flow Simulation</h4>
                                    <p className="text-sm text-muted-foreground">
                                        We simulate each day: solar generation meets your load first, excess charges
                                        your battery, then exports to grid. Shortfalls draw from battery, then grid.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg">
                                <div className="p-2 bg-emerald-500/20 rounded-lg h-fit">
                                    <PiggyBank className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h4 className="font-medium">4. Cost Calculation</h4>
                                    <p className="text-sm text-muted-foreground">
                                        We calculate what you would have paid with your chosen tariff - import costs
                                        minus export revenue. Compare with baseline (no solar) to see savings.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="formulas" className="space-y-4 mt-4">
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                    <Sun className="h-4 w-4 text-amber-500" />
                                    Solar Generation
                                </h4>
                                <div className="font-mono text-sm bg-white dark:bg-slate-800 p-3 rounded border">
                                    Generation (kWh) = GHI × System Size × Performance Ratio
                                </div>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li><strong>GHI</strong> = Global Horizontal Irradiance (kWh/m²/day) from NASA</li>
                                    <li><strong>System Size</strong> = Your panel capacity in kWp</li>
                                    <li><strong>Performance Ratio</strong> = 0.80 (accounts for real-world losses)</li>
                                </ul>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                    <Battery className="h-4 w-4 text-green-500" />
                                    Battery Energy Flow
                                </h4>
                                <div className="font-mono text-sm bg-white dark:bg-slate-800 p-3 rounded border space-y-1">
                                    <div>Self-consumed = min(Generation, Consumption)</div>
                                    <div>Excess = Generation - Self-consumed</div>
                                    <div>Battery Charge = min(Excess × √Efficiency, Capacity Available)</div>
                                    <div>Grid Export = Excess - Battery Charge</div>
                                </div>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li><strong>Round-trip Efficiency</strong> = 90% (split √90% each way)</li>
                                    <li><strong>Min SoC</strong> = 10% (battery reserve)</li>
                                    <li><strong>Max SoC</strong> = 100%</li>
                                </ul>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                    <PiggyBank className="h-4 w-4 text-emerald-500" />
                                    Financial Calculations
                                </h4>
                                <div className="font-mono text-sm bg-white dark:bg-slate-800 p-3 rounded border space-y-1">
                                    <div>Import Cost = Grid Import (kWh) × Import Rate (p/kWh)</div>
                                    <div>Export Revenue = Grid Export (kWh) × Export Rate (p/kWh)</div>
                                    <div>Net Cost = Import Cost + Standing Charge - Export Revenue</div>
                                    <div>Annual Savings = Baseline Cost - Solar+Battery Cost</div>
                                    <div>Payback Years = System Cost ÷ Annual Savings</div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-amber-500" />
                                    Battery Arbitrage (Time-of-Use Tariffs)
                                </h4>
                                <div className="font-mono text-sm bg-white dark:bg-slate-800 p-3 rounded border space-y-1">
                                    <div>Overnight Charge = Battery capacity charged at off-peak rate</div>
                                    <div>Peak Export = Battery discharge during peak hours (4-7pm)</div>
                                    <div>Arbitrage Profit = (Export Rate - Off-peak Rate) × kWh</div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Example: Octopus Flux charges at 10p overnight, exports at 25p peak = 15p/kWh profit
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="sources" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            <a
                                href="https://developer.octopus.energy/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div>
                                    <h4 className="font-medium">Octopus Energy API</h4>
                                    <p className="text-sm text-muted-foreground">Your actual half-hourly consumption data</p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>

                            <a
                                href="https://power.larc.nasa.gov/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div>
                                    <h4 className="font-medium">NASA POWER</h4>
                                    <p className="text-sm text-muted-foreground">Satellite-derived solar irradiance data</p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>

                            <a
                                href="https://postcodes.io/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div>
                                    <h4 className="font-medium">Postcodes.io</h4>
                                    <p className="text-sm text-muted-foreground">UK postcode to lat/long conversion</p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>

                            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg">
                                <h4 className="font-medium text-amber-800 dark:text-amber-200">Tariff Data</h4>
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                    Tariff rates are based on publicly available Octopus Energy pricing as of January 2026.
                                    Actual rates may vary by region and change over time.
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
