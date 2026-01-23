import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../@/components/ui/card';
import { Label } from '../../@/components/ui/label';
import { Input } from '../../@/components/ui/input';
import { Button } from '../../@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../@/components/ui/select';
import { Loader2, CheckCircle2, AlertCircle, Zap, MapPin, Info } from 'lucide-react';
import type { BatteryConfig, TariffConfig, PVSystemConfig } from '@/types';
import type { DiscoveredMeter } from '@/hooks/use-account-discovery';
import { useAccountDiscovery } from '@/hooks/use-account-discovery';
import { UK_BATTERY_PRESETS } from '@/lib/battery-engine';
import { UK_PV_PRESETS } from '@/lib/solar-generator';
import { UK_TARIFF_PRESETS } from '@/lib/cost-engine';

interface SimulationFormProps {
    onSubmit: (data: {
        apiKey: string;
        mpan: string;
        serialNumber: string;
        postcode: string;
        dateRange: { from: string; to: string };
        pvSystem: PVSystemConfig;
        pvPreset: keyof typeof UK_PV_PRESETS;
        battery: BatteryConfig;
        batteryPreset: keyof typeof UK_BATTERY_PRESETS;
        tariff: TariffConfig;
        tariffPreset: keyof typeof UK_TARIFF_PRESETS;
        monthlyDirectDebit?: number;
        systemCost?: number;
    }) => void;
    loading?: boolean;
}

export function SimulationForm({ onSubmit, loading }: SimulationFormProps) {
    // Step 1: Account discovery
    const [apiKey, setApiKey] = useState('');
    const accountDiscovery = useAccountDiscovery();

    // Step 2: Meter selection and configuration
    const [selectedMeter, setSelectedMeter] = useState<DiscoveredMeter | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [pvPreset, setPvPreset] = useState<keyof typeof UK_PV_PRESETS>('medium');
    const [batteryPreset, setBatteryPreset] = useState<keyof typeof UK_BATTERY_PRESETS>('medium');
    const [tariffPreset, setTariffPreset] = useState<keyof typeof UK_TARIFF_PRESETS>('octopusFlux');
    const [monthlyDirectDebit, setMonthlyDirectDebit] = useState('');
    const [systemCost, setSystemCost] = useState('');

    // Set default dates to last 12 months
    useEffect(() => {
        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        setDateTo(now.toISOString().split('T')[0]);
        setDateFrom(oneYearAgo.toISOString().split('T')[0]);
    }, []);

    const handleDiscoverAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        await accountDiscovery.discoverAccount(apiKey);
    };

    const handleSelectMeter = (meterId: string) => {
        const meter = accountDiscovery.meters?.find(
            m => `${m.mpan}:${m.serialNumber}` === meterId
        );
        setSelectedMeter(meter ?? null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMeter) return;

        const pvConfig: PVSystemConfig = {
            systemSizeKwp: UK_PV_PRESETS[pvPreset].systemSizeKwp,
            performanceRatio: UK_PV_PRESETS[pvPreset].performanceRatio,
        };

        const batteryConfig: BatteryConfig = { ...UK_BATTERY_PRESETS[batteryPreset] };

        const tariffConfig: TariffConfig = {
            import: { ...UK_TARIFF_PRESETS[tariffPreset].import },
            export: { ...UK_TARIFF_PRESETS[tariffPreset].export },
        };

        onSubmit({
            apiKey,
            mpan: selectedMeter.mpan,
            serialNumber: selectedMeter.serialNumber,
            postcode: selectedMeter.postcode,
            dateRange: { from: dateFrom, to: dateTo },
            pvSystem: pvConfig,
            pvPreset,
            battery: batteryConfig,
            batteryPreset,
            tariff: tariffConfig,
            tariffPreset,
            monthlyDirectDebit: monthlyDirectDebit ? parseFloat(monthlyDirectDebit) : undefined,
            systemCost: systemCost ? parseFloat(systemCost) : undefined,
        });
    };

    const handleReset = () => {
        accountDiscovery.reset();
        setSelectedMeter(null);
    };

    // Step 1: API Key entry and account discovery
    if (!accountDiscovery.isAuthenticated) {
        return (
            <form onSubmit={handleDiscoverAccount}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5" />
                            Connect to Octopus Energy
                        </CardTitle>
                        <CardDescription>
                            Enter your API key to fetch your meter details automatically
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="apiKey">API Key</Label>
                            <Input
                                id="apiKey"
                                type="password"
                                placeholder="sk_live_..."
                                value={apiKey}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                                required
                                disabled={accountDiscovery.loading}
                            />
                            <p className="text-xs text-muted-foreground">
                                Get your API key from{' '}
                                <a
                                    href="https://octopus.energy/dashboard/new/accounts/personal-details/api-access"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline text-primary"
                                >
                                    your Octopus account dashboard
                                </a>
                            </p>
                        </div>

                        {accountDiscovery.error && (
                            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {accountDiscovery.error}
                            </div>
                        )}

                        <Button type="submit" disabled={accountDiscovery.loading || !apiKey}>
                            {accountDiscovery.loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                'Connect Account'
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </form>
        );
    }

    // Step 2: Meter selection and simulation configuration
    return (
        <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
                {/* Account Connected Status */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                Connected to Octopus Energy
                            </CardTitle>
                            <Button variant="outline" size="sm" onClick={handleReset}>
                                Disconnect
                            </Button>
                        </div>
                        {accountDiscovery.accounts && accountDiscovery.accounts.length > 0 && (
                            <CardDescription>
                                Account: {accountDiscovery.accounts[0].number}
                            </CardDescription>
                        )}
                    </CardHeader>
                </Card>

                {/* Meter Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle>Select Your Meter</CardTitle>
                        <CardDescription>
                            {accountDiscovery.meters?.length === 1
                                ? 'We found 1 electricity meter on your account'
                                : `We found ${accountDiscovery.meters?.length ?? 0} electricity meters on your account`
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="meter">Electricity Meter</Label>
                            <Select
                                value={selectedMeter ? `${selectedMeter.mpan}:${selectedMeter.serialNumber}` : ''}
                                onValueChange={handleSelectMeter}
                            >
                                <SelectTrigger id="meter">
                                    <SelectValue placeholder="Select a meter" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accountDiscovery.meters?.map(meter => (
                                        <SelectItem
                                            key={`${meter.mpan}:${meter.serialNumber}`}
                                            value={`${meter.mpan}:${meter.serialNumber}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">{meter.address}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    MPAN: {meter.mpan}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedMeter && (
                            <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-sm">
                                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium">{selectedMeter.address}</p>
                                    <p className="text-muted-foreground">
                                        {selectedMeter.postcode} • Serial: {selectedMeter.serialNumber}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="dateFrom">Period From</Label>
                                <Input
                                    id="dateFrom"
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="dateTo">Period To</Label>
                                <Input
                                    id="dateTo"
                                    type="date"
                                    value={dateTo}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* System Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>System Configuration</CardTitle>
                        <CardDescription>Solar and battery specifications</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="pvPreset">PV System Size</Label>
                                <div className="group relative">
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border rounded-lg shadow-lg text-sm w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        <p className="font-medium mb-1">What is kWp?</p>
                                        <p className="text-muted-foreground text-xs">kWp (kilowatt-peak) measures a solar panel's maximum output under ideal conditions. A 5kWp system typically needs about 20m² of roof space and generates ~4,000-4,500 kWh/year in the UK.</p>
                                    </div>
                                </div>
                            </div>
                            <Select value={pvPreset} onValueChange={(v: string) => setPvPreset(v as keyof typeof UK_PV_PRESETS)}>
                                <SelectTrigger id="pvPreset">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Small - {UK_PV_PRESETS.small.systemSizeKwp}kWp ({UK_PV_PRESETS.small.description})</SelectItem>
                                    <SelectItem value="medium">Medium - {UK_PV_PRESETS.medium.systemSizeKwp}kWp ({UK_PV_PRESETS.medium.description})</SelectItem>
                                    <SelectItem value="large">Large - {UK_PV_PRESETS.large.systemSizeKwp}kWp ({UK_PV_PRESETS.large.description})</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="batteryPreset">Battery Capacity</Label>
                                <div className="group relative">
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border rounded-lg shadow-lg text-sm w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        <p className="font-medium mb-1">What is kWh?</p>
                                        <p className="text-muted-foreground text-xs">kWh (kilowatt-hour) measures energy storage. A 10kWh battery can power a typical home for 4-6 hours. Larger batteries let you store more solar to use at night or sell back at peak rates.</p>
                                    </div>
                                </div>
                            </div>
                            <Select value={batteryPreset} onValueChange={(v: string) => setBatteryPreset(v as keyof typeof UK_BATTERY_PRESETS)}>
                                <SelectTrigger id="batteryPreset">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Small - {UK_BATTERY_PRESETS.small.capacityKwh}kWh</SelectItem>
                                    <SelectItem value="medium">Medium - {UK_BATTERY_PRESETS.medium.capacityKwh}kWh</SelectItem>
                                    <SelectItem value="large">Large - {UK_BATTERY_PRESETS.large.capacityKwh}kWh</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Tariff & Costs */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tariff & Costs</CardTitle>
                        <CardDescription>Energy rates and system cost</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="tariffPreset">Energy Tariff</Label>
                            <Select value={tariffPreset} onValueChange={(v: string) => setTariffPreset(v as keyof typeof UK_TARIFF_PRESETS)}>
                                <SelectTrigger id="tariffPreset">
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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="monthlyDirectDebit">Monthly Direct Debit (£)</Label>
                                <Input
                                    id="monthlyDirectDebit"
                                    type="number"
                                    step="0.01"
                                    placeholder="150.00"
                                    value={monthlyDirectDebit}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonthlyDirectDebit(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="systemCost">System Cost (£)</Label>
                                <Input
                                    id="systemCost"
                                    type="number"
                                    step="100"
                                    placeholder="10000"
                                    value={systemCost}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSystemCost(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Button type="submit" size="lg" disabled={loading || !selectedMeter} className="w-full">
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Running Simulation...
                        </>
                    ) : (
                        'Run Simulation'
                    )}
                </Button>
            </div>
        </form>
    );
}
