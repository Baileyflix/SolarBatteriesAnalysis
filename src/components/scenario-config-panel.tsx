import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import { Label } from '../../@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../@/components/ui/select';
import { Input } from '../../@/components/ui/input';
import { Slider } from '../../@/components/ui/slider';
import { Button } from '../../@/components/ui/button';
import { Badge } from '../../@/components/ui/badge';
import { Sun, Battery, Zap, Settings2, Info, RefreshCw, PoundSterling, Car, Flame, Sparkles, CircleDot, Lock } from 'lucide-react';
import { UK_BATTERY_PRESETS } from '@/lib/battery-engine';
import { UK_PV_PRESETS } from '@/lib/solar-generator';
import { UK_TARIFF_PRESETS } from '@/lib/cost-engine';
import type { BatteryConfig, TariffConfig, PVSystemConfig, ActualTariffInfo } from '@/types';
import { useState } from 'react';

type PVPresetKey = keyof typeof UK_PV_PRESETS;
type BatteryPresetKey = keyof typeof UK_BATTERY_PRESETS;
type TariffPresetKey = keyof typeof UK_TARIFF_PRESETS | 'myTariff';

interface ScenarioConfig {
    pvPreset: PVPresetKey;
    pvSystem: PVSystemConfig;
    batteryPreset: BatteryPresetKey;
    battery: BatteryConfig;
    tariffPreset: TariffPresetKey;
    tariff: TariffConfig;
    systemCost: number;
    monthlyDirectDebit: number;
}

interface ScenarioConfigPanelProps {
    config: ScenarioConfig;
    onChange: (config: ScenarioConfig) => void;
    onRunSimulation?: () => void;
    isLoading?: boolean;
    hasChanges?: boolean;
    actualTariff?: ActualTariffInfo | null;
    onUseMyTariff?: () => void;
}

/** Get icon for tariff category */
function getTariffCategoryIcon(category: string) {
    switch (category) {
        case 'ev':
            return <Car className="h-3 w-3" />;
        case 'solar':
            return <Sun className="h-3 w-3" />;
        case 'heatpump':
            return <Flame className="h-3 w-3" />;
        default:
            return <CircleDot className="h-3 w-3" />;
    }
}

/** Get badge variant for tariff category */
function getTariffCategoryBadge(category: string) {
    switch (category) {
        case 'ev':
            return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
        case 'solar':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
        case 'heatpump':
            return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
        default:
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
}

/** Get eligibility requirement text */
function getEligibilityText(eligibility: string): string | null {
    switch (eligibility) {
        case 'ev':
            return 'Requires EV charger';
        case 'heatpump':
            return 'Requires heat pump';
        case 'solar':
            return 'Requires solar panels';
        default:
            return null;
    }
}

/** Info tooltip component */
function InfoTooltip({ text }: { text: string }) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="relative inline-block">
            <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={() => setIsVisible(!isVisible)}
                aria-label="More information"
            >
                <Info className="h-3.5 w-3.5" />
            </button>
            {isVisible && (
                <div className="absolute z-50 left-0 bottom-full mb-2 w-56 p-2 text-xs bg-popover text-popover-foreground border rounded-md shadow-lg">
                    {text}
                </div>
            )}
        </div>
    );
}

export function ScenarioConfigPanel({
    config,
    onChange,
    onRunSimulation,
    isLoading = false,
    hasChanges = false,
    actualTariff,
    onUseMyTariff,
}: ScenarioConfigPanelProps) {
    const handlePvPresetChange = (preset: PVPresetKey): void => {
        const pvConfig = UK_PV_PRESETS[preset];
        onChange({
            ...config,
            pvPreset: preset,
            pvSystem: {
                systemSizeKwp: pvConfig.systemSizeKwp,
                performanceRatio: pvConfig.performanceRatio,
            },
        });
    };

    const handlePvSizeChange = (values: number[]): void => {
        const systemSizeKwp = values[0] ?? config.pvSystem.systemSizeKwp;
        onChange({
            ...config,
            pvPreset: 'custom' as PVPresetKey,
            pvSystem: {
                ...config.pvSystem,
                systemSizeKwp,
            },
        });
    };

    const handleBatteryPresetChange = (preset: BatteryPresetKey): void => {
        const batteryConfig = UK_BATTERY_PRESETS[preset];
        onChange({
            ...config,
            batteryPreset: preset,
            battery: { ...batteryConfig },
        });
    };

    const handleBatteryCapacityChange = (values: number[]): void => {
        const capacityKwh = values[0] ?? config.battery.capacityKwh;
        const scaleFactor = capacityKwh / (UK_BATTERY_PRESETS.medium.capacityKwh);
        onChange({
            ...config,
            batteryPreset: 'custom' as BatteryPresetKey,
            battery: {
                ...config.battery,
                capacityKwh,
                maxChargePowerKw: Math.round(scaleFactor * UK_BATTERY_PRESETS.medium.maxChargePowerKw * 10) / 10,
                maxDischargePowerKw: Math.round(scaleFactor * UK_BATTERY_PRESETS.medium.maxDischargePowerKw * 10) / 10,
            },
        });
    };

    const handleTariffPresetChange = (preset: TariffPresetKey): void => {
        // Handle 'myTariff' specially - use actual tariff rates
        if (preset === 'myTariff' && actualTariff) {
            onChange({
                ...config,
                tariffPreset: 'myTariff',
                tariff: {
                    import: {
                        type: actualTariff.isVariable ? 'agile' : 'flat',
                        standardRatePence: actualTariff.unitRatePence,
                        standingChargePence: actualTariff.standingChargePence,
                    },
                    export: {
                        name: 'Your Export Tariff',
                        // Default to SEG rate if no export tariff detected
                        ratePence: 15.0,
                    },
                },
            });
            return;
        }

        // Standard preset handling
        if (preset !== 'myTariff') {
            const tariffConfig = UK_TARIFF_PRESETS[preset];
            onChange({
                ...config,
                tariffPreset: preset,
                tariff: {
                    import: { ...tariffConfig.import },
                    export: { ...tariffConfig.export },
                },
            });
        }
    };

    const handleSystemCostChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        onChange({
            ...config,
            systemCost: parseFloat(e.target.value) || 0,
        });
    };

    const handleDirectDebitChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        onChange({
            ...config,
            monthlyDirectDebit: parseFloat(e.target.value) || 0,
        });
    };

    return (
        <Card>
            <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                            <Settings2 className="h-4 w-4 sm:h-5 sm:w-5" />
                            Your Solar Setup
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Adjust your system to see how it would affect your bills
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:gap-6 p-3 sm:p-6 pt-0">
                {/* PV System */}
                <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-amber-500" />
                        <Label className="text-xs sm:text-sm font-medium">Solar PV System</Label>
                    </div>
                    <div className="grid gap-3 sm:gap-4 pl-4 sm:pl-6">
                        <div className="grid gap-1.5 sm:gap-2">
                            <Label htmlFor="pvPreset" className="text-[10px] sm:text-xs text-muted-foreground">Preset</Label>
                            <Select value={config.pvPreset} onValueChange={(v: string) => handlePvPresetChange(v as PVPresetKey)}>
                                <SelectTrigger id="pvPreset" className="h-8 sm:h-9 text-xs sm:text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Small ({UK_PV_PRESETS.small.systemSizeKwp}kWp)</SelectItem>
                                    <SelectItem value="medium">Medium ({UK_PV_PRESETS.medium.systemSizeKwp}kWp)</SelectItem>
                                    <SelectItem value="large">Large ({UK_PV_PRESETS.large.systemSizeKwp}kWp)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5 sm:gap-2">
                            <div className="flex justify-between items-center text-[10px] sm:text-xs">
                                <span className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground">
                                    System Size
                                    <InfoTooltip text="Peak power output of your solar panels (kWp). A typical 400W panel = 0.4 kWp. Small systems (3.5 kWp) have ~9 panels, medium (5 kWp) ~12 panels, large (7 kWp) ~18 panels. Octopus considers up to 4 kWp as standard domestic." />
                                </span>
                                <span className="font-medium">{config.pvSystem.systemSizeKwp.toFixed(1)} kWp</span>
                            </div>
                            <Slider
                                value={[config.pvSystem.systemSizeKwp]}
                                onValueChange={handlePvSizeChange}
                                min={1}
                                max={10}
                                step={0.5}
                                className="py-1.5 sm:py-2"
                            />
                            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                                <span>1 kWp</span>
                                <span>10 kWp</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Battery */}
                <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2">
                        <Battery className="h-4 w-4 text-green-500" />
                        <Label className="text-xs sm:text-sm font-medium">Battery Storage</Label>
                    </div>
                    <div className="grid gap-3 sm:gap-4 pl-4 sm:pl-6">
                        <div className="grid gap-1.5 sm:gap-2">
                            <Label htmlFor="batteryPreset" className="text-[10px] sm:text-xs text-muted-foreground">Preset</Label>
                            <Select value={config.batteryPreset} onValueChange={(v: string) => handleBatteryPresetChange(v as BatteryPresetKey)}>
                                <SelectTrigger id="batteryPreset" className="h-8 sm:h-9 text-xs sm:text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Small ({UK_BATTERY_PRESETS.small.capacityKwh}kWh)</SelectItem>
                                    <SelectItem value="medium">Medium ({UK_BATTERY_PRESETS.medium.capacityKwh}kWh)</SelectItem>
                                    <SelectItem value="large">Large ({UK_BATTERY_PRESETS.large.capacityKwh}kWh)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5 sm:gap-2">
                            <div className="flex justify-between items-center text-[10px] sm:text-xs">
                                <span className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground">
                                    Capacity
                                    <InfoTooltip text="The amount of energy your battery can store in kilowatt-hours (kWh). A typical UK home uses 8-10 kWh per day. Set to 0 to see results without a battery." />
                                </span>
                                <span className="font-medium">{config.battery.capacityKwh.toFixed(1)} kWh</span>
                            </div>
                            <Slider
                                value={[config.battery.capacityKwh]}
                                onValueChange={handleBatteryCapacityChange}
                                min={0}
                                max={30}
                                step={0.5}
                                className="py-1.5 sm:py-2"
                            />
                            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                                <span>0 kWh</span>
                                <span>30 kWh</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tariff */}
                <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        <Label className="text-xs sm:text-sm font-medium">Energy Tariff</Label>
                    </div>
                    <div className="grid gap-3 sm:gap-4 pl-4 sm:pl-6">
                        {/* Show detected tariff if available */}
                        {actualTariff && (
                            <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles className="h-3 w-3 text-green-600" />
                                        <span className="text-[10px] sm:text-xs font-medium text-green-700 dark:text-green-300">Your Current Tariff</span>
                                    </div>
                                    {config.tariffPreset === 'myTariff' ? (
                                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200">
                                            ACTIVE
                                        </Badge>
                                    ) : onUseMyTariff && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={onUseMyTariff}
                                            className="h-5 px-2 text-[10px] text-green-700 hover:text-green-800 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900"
                                        >
                                            Use this
                                        </Button>
                                    )}
                                </div>
                                <p className="text-xs sm:text-sm font-medium">{actualTariff.displayName}</p>
                                <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                    {/* Show TOU rates if available, otherwise show standard rate */}
                                    {actualTariff.hasTimeOfUseRates && actualTariff.offPeakRatePence && actualTariff.peakRatePence ? (
                                        <>
                                            <span className="text-green-600">{actualTariff.offPeakRatePence.toFixed(1)}p off-peak</span>
                                            <span>•</span>
                                            <span>{actualTariff.unitRatePence.toFixed(1)}p standard</span>
                                            <span>•</span>
                                            <span className="text-red-500">{actualTariff.peakRatePence.toFixed(1)}p peak</span>
                                        </>
                                    ) : (
                                        <span>{actualTariff.unitRatePence.toFixed(1)}p/kWh</span>
                                    )}
                                    <span>•</span>
                                    <span>{actualTariff.standingChargePence.toFixed(1)}p/day</span>
                                    {actualTariff.isVariable && !actualTariff.hasTimeOfUseRates && (
                                        <>
                                            <span>•</span>
                                            <span className="text-amber-600">Variable</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="grid gap-1.5 sm:gap-2">
                            <Label htmlFor="tariffPreset" className="text-[10px] sm:text-xs text-muted-foreground">
                                {actualTariff ? 'Compare with tariff' : 'Tariff'}
                            </Label>
                            <Select value={config.tariffPreset} onValueChange={(v: string) => handleTariffPresetChange(v as TariffPresetKey)}>
                                <SelectTrigger id="tariffPreset" className="h-8 sm:h-9 text-xs sm:text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {/* Show My Tariff option if available */}
                                    {actualTariff && (
                                        <>
                                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Your Tariff</div>
                                            <SelectItem value="myTariff">
                                                <span className="flex items-center gap-2">
                                                    <Sparkles className="h-3 w-3 text-green-600" />
                                                    {actualTariff.displayName}
                                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                                        YOURS
                                                    </Badge>
                                                </span>
                                            </SelectItem>
                                        </>
                                    )}
                                    {/* Group by category */}
                                    {/* Solar Tariffs */}
                                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Solar & Export</div>
                                    {(Object.keys(UK_TARIFF_PRESETS) as Array<keyof typeof UK_TARIFF_PRESETS>)
                                        .filter(key => UK_TARIFF_PRESETS[key].category === 'solar')
                                        .map((key) => {
                                            const tariff = UK_TARIFF_PRESETS[key];
                                            return (
                                                <SelectItem key={key} value={key}>
                                                    <span className="flex items-center gap-2">
                                                        {getTariffCategoryIcon(tariff.category)}
                                                        {tariff.displayLabel}
                                                        {tariff.recommended && (
                                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                                                BEST
                                                            </Badge>
                                                        )}
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    {/* EV Tariffs - show eligibility requirement */}
                                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1 flex items-center gap-1">
                                        EV & Off-Peak
                                        <Lock className="h-2.5 w-2.5 text-muted-foreground/60" />
                                    </div>
                                    {(Object.keys(UK_TARIFF_PRESETS) as Array<keyof typeof UK_TARIFF_PRESETS>)
                                        .filter(key => UK_TARIFF_PRESETS[key].category === 'ev')
                                        .map((key) => {
                                            const tariff = UK_TARIFF_PRESETS[key];
                                            const eligibilityText = getEligibilityText(tariff.eligibility);
                                            return (
                                                <SelectItem key={key} value={key} className="text-muted-foreground">
                                                    <span className="flex items-center gap-2">
                                                        {getTariffCategoryIcon(tariff.category)}
                                                        <span className="flex flex-col">
                                                            <span>{tariff.displayLabel}</span>
                                                            {eligibilityText && (
                                                                <span className="text-[9px] text-muted-foreground/80">{eligibilityText}</span>
                                                            )}
                                                        </span>
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    {/* Heat Pump Tariffs - show eligibility requirement */}
                                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1 flex items-center gap-1">
                                        Heat Pump
                                        <Lock className="h-2.5 w-2.5 text-muted-foreground/60" />
                                    </div>
                                    {(Object.keys(UK_TARIFF_PRESETS) as Array<keyof typeof UK_TARIFF_PRESETS>)
                                        .filter(key => UK_TARIFF_PRESETS[key].category === 'heatpump')
                                        .map((key) => {
                                            const tariff = UK_TARIFF_PRESETS[key];
                                            const eligibilityText = getEligibilityText(tariff.eligibility);
                                            return (
                                                <SelectItem key={key} value={key} className="text-muted-foreground">
                                                    <span className="flex items-center gap-2">
                                                        {getTariffCategoryIcon(tariff.category)}
                                                        <span className="flex flex-col">
                                                            <span>{tariff.displayLabel}</span>
                                                            {eligibilityText && (
                                                                <span className="text-[9px] text-muted-foreground/80">{eligibilityText}</span>
                                                            )}
                                                        </span>
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    {/* Standard Tariffs */}
                                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">Standard & Variable</div>
                                    {(Object.keys(UK_TARIFF_PRESETS) as Array<keyof typeof UK_TARIFF_PRESETS>)
                                        .filter(key => UK_TARIFF_PRESETS[key].category === 'standard')
                                        .map((key) => {
                                            const tariff = UK_TARIFF_PRESETS[key];
                                            return (
                                                <SelectItem key={key} value={key}>
                                                    <span className="flex items-center gap-2">
                                                        {getTariffCategoryIcon(tariff.category)}
                                                        {tariff.displayLabel}
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Tariff Details Card */}
                        <div className="p-2 sm:p-3 bg-muted/50 rounded-lg space-y-1.5 sm:space-y-2">
                            <div className="flex items-center gap-2">
                                {config.tariffPreset === 'myTariff' ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                        <Sparkles className="h-2.5 w-2.5" />
                                        YOUR TARIFF
                                    </span>
                                ) : (
                                    <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${getTariffCategoryBadge(UK_TARIFF_PRESETS[config.tariffPreset].category)}`}>
                                        {getTariffCategoryIcon(UK_TARIFF_PRESETS[config.tariffPreset].category)}
                                        {UK_TARIFF_PRESETS[config.tariffPreset].category.toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                                {config.tariffPreset === 'myTariff'
                                    ? 'Using your actual Octopus Energy tariff rates for accurate calculations.'
                                    : UK_TARIFF_PRESETS[config.tariffPreset].description}
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1">
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                    <div>
                                        <span className="text-[10px] sm:text-xs text-muted-foreground">Import</span>
                                        <p className="text-xs sm:text-sm font-medium">{config.tariff.import.standardRatePence.toFixed(1)}p<span className="text-[10px] sm:text-xs text-muted-foreground">/kWh</span></p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                    <div>
                                        <span className="text-[10px] sm:text-xs text-muted-foreground">Export</span>
                                        <p className="text-xs sm:text-sm font-medium">{config.tariff.export.ratePence.toFixed(1)}p<span className="text-[10px] sm:text-xs text-muted-foreground">/kWh</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Financial Inputs */}
                <div className="space-y-3 sm:space-y-4 pt-2 border-t">
                    <div className="flex items-center gap-2">
                        <PoundSterling className="h-4 w-4 text-emerald-600" />
                        <Label className="text-xs sm:text-sm font-medium">Financial Details</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4 pl-4 sm:pl-6">
                        <div className="grid gap-1.5 sm:gap-2">
                            <Label htmlFor="systemCost" className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                                System Cost (£)
                                <InfoTooltip text="Total installation cost for solar panels and battery. UK average is £8,000-12,000 for panels plus £2,500-5,000 per 5kWh of battery." />
                            </Label>
                            <Input
                                id="systemCost"
                                type="number"
                                step="100"
                                value={config.systemCost || ''}
                                onChange={handleSystemCostChange}
                                placeholder="10000"
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                            />
                        </div>
                        <div className="grid gap-1.5 sm:gap-2">
                            <Label htmlFor="monthlyDD" className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                                Monthly DD (£)
                                <InfoTooltip text="Your current monthly Direct Debit to your energy supplier. Used to calculate potential savings." />
                            </Label>
                            <Input
                                id="monthlyDD"
                                type="number"
                                step="5"
                                value={config.monthlyDirectDebit || ''}
                                onChange={handleDirectDebitChange}
                                placeholder="150"
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Update Results Button */}
                {onRunSimulation && (
                    <Button
                        onClick={onRunSimulation}
                        disabled={isLoading}
                        className="w-full"
                        size="default"
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Calculating...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                {hasChanges ? 'Update Results' : 'Recalculate'}
                            </>
                        )}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

export type { ScenarioConfig, PVPresetKey, BatteryPresetKey, TariffPresetKey };
