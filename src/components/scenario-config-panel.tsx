import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import { Label } from '../../@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../@/components/ui/select';
import { Input } from '../../@/components/ui/input';
import { Slider } from '../../@/components/ui/slider';
import { Badge } from '../../@/components/ui/badge';
import { Sun, Battery, Zap, Settings2 } from 'lucide-react';
import { UK_BATTERY_PRESETS } from '@/lib/battery-engine';
import { UK_PV_PRESETS } from '@/lib/solar-generator';
import { UK_TARIFF_PRESETS } from '@/lib/cost-engine';
import type { BatteryConfig, TariffConfig, PVSystemConfig } from '@/types';

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
}

export function ScenarioConfigPanel({ config, onChange }: ScenarioConfigPanelProps) {
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
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">System Size</span>
                                <span className="font-medium">{config.pvSystem.systemSizeKwp.toFixed(1)} kWp</span>
                            </div>
                            <Slider
                                value={[config.pvSystem.systemSizeKwp]}
                                onValueChange={handlePvSizeChange}
                                min={1}
                                max={15}
                                step={0.5}
                                className="py-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>1 kWp</span>
                                <span>15 kWp</span>
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
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Capacity</span>
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
                                    {(Object.keys(UK_TARIFF_PRESETS) as Array<keyof typeof UK_TARIFF_PRESETS>).map((key) => (
                                        <SelectItem key={key} value={key}>
                                            {UK_TARIFF_PRESETS[key].displayLabel}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1">
                                <Label htmlFor="importRate" className="text-xs text-muted-foreground">Import Rate</Label>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-medium">{config.tariff.import.standardRatePence.toFixed(1)}p</span>
                                    <span className="text-xs text-muted-foreground">/kWh</span>
                                </div>
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="exportRate" className="text-xs text-muted-foreground">Export Rate</Label>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-medium">{config.tariff.export.ratePence.toFixed(1)}p</span>
                                    <span className="text-xs text-muted-foreground">/kWh</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Financial Inputs */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div className="grid gap-2">
                        <Label htmlFor="systemCost" className="text-xs text-muted-foreground">System Cost (£)</Label>
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
                        <Label htmlFor="monthlyDD" className="text-xs text-muted-foreground">Monthly DD (£)</Label>
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
            </CardContent>
        </Card>
    );
}

export type { ScenarioConfig, PVPresetKey, BatteryPresetKey, TariffPresetKey };
