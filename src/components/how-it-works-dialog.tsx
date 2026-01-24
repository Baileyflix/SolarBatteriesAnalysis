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
import { Info, Calculator, Sun, Battery, Zap, PiggyBank, ExternalLink, BookOpen } from 'lucide-react';

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
                                    PV Generation (Industry Standard)
                                </h4>
                                <div className="font-mono text-sm bg-white dark:bg-slate-800 p-3 rounded border">
                                    E = G × P<sub>peak</sub> × PR / G<sub>STC</sub>
                                </div>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li><strong>E</strong> = Energy output (kWh)</li>
                                    <li><strong>G</strong> = Global Horizontal Irradiance (kWh/m²/day)</li>
                                    <li><strong>P<sub>peak</sub></strong> = System rated power (kWp)</li>
                                    <li><strong>G<sub>STC</sub></strong> = 1 kW/m² (Standard Test Conditions)</li>
                                    <li><strong>PR</strong> = Performance Ratio (0.80 default)</li>
                                </ul>
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                    Based on IEC 61724 methodology. PR accounts for inverter efficiency (~97%),
                                    cable losses (~2%), temperature effects (~3-8%), soiling, and mismatch.
                                </p>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                    <Battery className="h-4 w-4 text-green-500" />
                                    Battery Dispatch Logic
                                </h4>
                                <div className="font-mono text-xs bg-white dark:bg-slate-800 p-3 rounded border space-y-1">
                                    <div>1. Solar meets load directly (no loss)</div>
                                    <div>2. Excess → Battery (×√η on charge)</div>
                                    <div>3. Remaining excess → Grid export</div>
                                    <div>4. Shortfall ← Battery (×√η on discharge)</div>
                                    <div>5. Remaining shortfall ← Grid import</div>
                                </div>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li><strong>η (Round-trip)</strong> = 90% (√90% ≈ 95% each way)</li>
                                    <li><strong>Depth of Discharge</strong> = 90% (10% reserve)</li>
                                    <li><strong>Max C-rate</strong> = 0.5C charge/discharge</li>
                                </ul>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                    <PiggyBank className="h-4 w-4 text-emerald-500" />
                                    Financial Model
                                </h4>
                                <div className="font-mono text-xs bg-white dark:bg-slate-800 p-3 rounded border space-y-1">
                                    <div>Daily Cost = (Import × Rate) + Standing − (Export × SEG)</div>
                                    <div>Savings = Baseline Cost − Solar+Battery Cost</div>
                                    <div>Simple Payback = System Cost ÷ Annual Savings</div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Note: This is a simple payback model. It doesn't account for electricity price inflation
                                    (which generally helps your ROI), panel degradation (~0.5%/year), maintenance costs,
                                    or time value of money. Real-world payback could be shorter or longer.
                                </p>
                            </div>

                            <div className="p-4 bg-amber-50 dark:bg-amber-950/50 rounded-lg space-y-2">
                                <h4 className="font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
                                    <Info className="h-4 w-4" />
                                    What This Model Doesn't Include
                                </h4>
                                <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc pl-4">
                                    <li>Panel tilt gains — real panels at ~35° get 10-15% more than our horizontal estimate</li>
                                    <li>Shading analysis — trees and buildings can significantly reduce output</li>
                                    <li>Panel orientation — we assume south-facing (optimal for UK)</li>
                                    <li>Smart tariff optimisation — battery uses simple "greedy" dispatch, not price-optimised</li>
                                    <li>Equipment degradation — panels lose ~0.5% output per year</li>
                                </ul>
                                <p className="text-xs text-amber-700 dark:text-amber-300 pt-2">
                                    This is why we recommend getting proper quotes from MCS-certified installers who can survey your property.
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="sources" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            <h4 className="font-medium text-sm text-muted-foreground">Data APIs</h4>

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
                                    <p className="text-sm text-muted-foreground">Satellite-derived solar irradiance (CERES/MERRA-2)</p>
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

                            <h4 className="font-medium text-sm text-muted-foreground mt-4">Methodology References</h4>

                            <a
                                href="https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/getting-started-pvgis/pvgis-data-sources-calculation-methods_en"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div>
                                    <h4 className="font-medium flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-blue-500" />
                                        EU JRC PVGIS
                                    </h4>
                                    <p className="text-sm text-muted-foreground">PV calculation methodology & validation data</p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>

                            <a
                                href="https://www.pveducation.org/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div>
                                    <h4 className="font-medium flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-blue-500" />
                                        PV Education
                                    </h4>
                                    <p className="text-sm text-muted-foreground">Solar cell theory & calculation fundamentals</p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>

                            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg">
                                <h4 className="font-medium text-amber-800 dark:text-amber-200">Tariff Data</h4>
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                    Tariff rates are based on publicly available Octopus Energy pricing and may not reflect
                                    current rates. When you connect your account, we fetch your actual tariff rates.
                                    Regional variations apply.
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
