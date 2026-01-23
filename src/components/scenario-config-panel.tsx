import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import { Label } from '../../@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../@/components/ui/select';
import { Input } from '../../@/components/ui/input';
import { Slider } from '../../@/components/ui/slider';
import { Button } from '../../@/components/ui/button';
import { Sun, Battery, Zap, Settings2, Info, RefreshCw, PoundSterling } from 'lucide-react';
import { UK_BATTERY_PRESETS } from '@/lib/battery-engine';
import { UK_PV_PRESETS } from '@/lib/solar-generator';
import { UK_TARIFF_PRESETS } from '@/lib/cost-engine';
import type { BatteryConfig, TariffConfig, PVSystemConfig } from '@/types';
import { useState } from 'react';

type PVPresetKey = keyof typeof UK_PV_PRESETS;
type BatteryPresetKey = keyof typeof UK_BATTERY_PRESETS;
type TariffPresetKey = keyof typeof UK_TARIFF_PRESETS;

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
        const tariffConfig = UK_TARIFF_PRESETS[preset];
        onChange({
            ...config,
            tariffPreset: preset,
            tariff: {
                import: { ...tariffConfig.import },
                export: { ...tariffConfig.export },
            },
        });
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
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Settings2 className="h-5 w-5" />
                            Your Solar Setup
                        </CardTitle>
                        <CardDescription>
                            Adjust your system to see how it would affect your bills
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-6">
                {/* PV System */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-amber-500" />
                        <Label className="text-sm font-medium">Solar PV System</Label>
                    </div>
                    <div className="grid gap-4 pl-6">
                        <div className="grid gap-2">
                            <Label htmlFor="pvPreset" className="text-xs text-muted-foreground">Preset</Label>
                            <Select value={config.pvPreset} onValueChange={(v: string) => handlePvPresetChange(v as PVPresetKey)}>
                                <SelectTrigger id="pvPreset" className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Small ({UK_PV_PRESETS.small.systemSizeKwp}kWp)</SelectItem>
                                    <SelectItem value="medium">Medium ({UK_PV_PRESETS.medium.systemSizeKwp}kWp)</SelectItem>
                                    <SelectItem value="large">Large ({UK_PV_PRESETS.large.systemSizeKwp}kWp)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
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
                                className="py-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>1 kWp (~3 panels)</span>
                                <span>10 kWp (~25 panels)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Battery */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Battery className="h-4 w-4 text-green-500" />
                        <Label className="text-sm font-medium">Battery Storage</Label>
                    </div>
                    <div className="grid gap-4 pl-6">
                        <div className="grid gap-2">
                            <Label htmlFor="batteryPreset" className="text-xs text-muted-foreground">Preset</Label>
                            <Select value={config.batteryPreset} onValueChange={(v: string) => handleBatteryPresetChange(v as BatteryPresetKey)}>
                                <SelectTrigger id="batteryPreset" className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Small ({UK_BATTERY_PRESETS.small.capacityKwh}kWh)</SelectItem>
                                    <SelectItem value="medium">Medium ({UK_BATTERY_PRESETS.medium.capacityKwh}kWh)</SelectItem>
                                    <SelectItem value="large">Large ({UK_BATTERY_PRESETS.large.capacityKwh}kWh)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
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
                                className="py-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>0 kWh (no battery)</span>
                                <span>30 kWh</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tariff */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        <Label className="text-sm font-medium">Energy Tariff</Label>
                    </div>
                    <div className="grid gap-4 pl-6">
                        <div className="grid gap-2">
                            <Label htmlFor="tariffPreset" className="text-xs text-muted-foreground">Tariff</Label>
                            <Select value={config.tariffPreset} onValueChange={(v: string) => handleTariffPresetChange(v as TariffPresetKey)}>
                                <SelectTrigger id="tariffPreset" className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(UK_TARIFF_PRESETS) as Array<keyof typeof UK_TARIFF_PRESETS>).map((key) => {
                                        const tariff = UK_TARIFF_PRESETS[key];
                                        return (
                                            <SelectItem key={key} value={key}>
                                                <span className="flex items-center gap-2">
                                                    {tariff.displayLabel}
                                                    {tariff.recommended && (
                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                                            BEST
                                                        </span>
                                                    )}
                                                </span>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Tariff Details Card */}
                        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                            <p className="text-xs text-muted-foreground">
                                {UK_TARIFF_PRESETS[config.tariffPreset].description}
                            </p>
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                    <div>
                                        <span className="text-xs text-muted-foreground">Import</span>
                                        <p className="text-sm font-medium">{config.tariff.import.standardRatePence.toFixed(1)}p<span className="text-xs text-muted-foreground">/kWh</span></p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                    <div>
                                        <span className="text-xs text-muted-foreground">Export</span>
                                        <p className="text-sm font-medium">{config.tariff.export.ratePence.toFixed(1)}p<span className="text-xs text-muted-foreground">/kWh</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Financial Inputs */}
                <div className="space-y-4 pt-2 border-t">
                    <div className="flex items-center gap-2">
                        <PoundSterling className="h-4 w-4 text-emerald-600" />
                        <Label className="text-sm font-medium">Financial Details</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pl-6">
                        <div className="grid gap-2">
                            <Label htmlFor="systemCost" className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                                className="h-9"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="monthlyDD" className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                                className="h-9"
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
                        size="lg"
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
