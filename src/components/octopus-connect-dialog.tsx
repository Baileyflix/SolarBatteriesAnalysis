import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../@/components/ui/dialog';
import { Button } from '../../@/components/ui/button';
import { Input } from '../../@/components/ui/input';
import { Label } from '../../@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../@/components/ui/select';
import { useAccountDiscovery } from '@/hooks/use-account-discovery';
import { Loader2, Zap, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

interface OctopusConnectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConnect: (data: {
        apiKey: string;
        mpan: string;
        serialNumber: string;
        postcode: string;
        dateRange: { from: string; to: string };
    }) => void;
}

export function OctopusConnectDialog({ open, onOpenChange, onConnect }: OctopusConnectDialogProps) {
    const [apiKey, setApiKey] = useState('');
    const [selectedMeter, setSelectedMeter] = useState<string>('');
    const [postcode, setPostcode] = useState('');
    const [step, setStep] = useState<'api-key' | 'select-meter'>('api-key');

    const { meters, loading, error, discoverAccount, reset } = useAccountDiscovery();

    // Calculate date range (last 12 months)
    const getDateRange = () => {
        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return {
            from: oneYearAgo.toISOString().split('T')[0],
            to: now.toISOString().split('T')[0],
        };
    };

    const handleApiKeySubmit = async () => {
        if (!apiKey.trim()) return;
        await discoverAccount(apiKey.trim());
    };

    // Move to meter selection when meters are loaded
    useEffect(() => {
        if (meters && meters.length > 0 && step === 'api-key') {
            setStep('select-meter');
            // Auto-select if only one meter and auto-fill postcode
            if (meters.length === 1) {
                setSelectedMeter(`${meters[0].mpan}|${meters[0].serialNumber}|${meters[0].postcode}`);
                setPostcode(meters[0].postcode);
            }
        }
    }, [meters, step]);

    // Auto-fill postcode when meter is selected
    useEffect(() => {
        if (selectedMeter) {
            const parts = selectedMeter.split('|');
            if (parts.length >= 3) {
                setPostcode(parts[2]);
            }
        }
    }, [selectedMeter]);

    const handleMeterSelect = () => {
        if (!selectedMeter || !postcode) return;
        const [mpan, serialNumber] = selectedMeter.split('|');
        onConnect({
            apiKey: apiKey.trim(),
            mpan,
            serialNumber,
            postcode: postcode.trim().toUpperCase(),
            dateRange: getDateRange(),
        });
        onOpenChange(false);
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Reset state when closing
            setStep('api-key');
            setApiKey('');
            setSelectedMeter('');
            setPostcode('');
            reset();
        }
        onOpenChange(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Connect to Octopus Energy
                    </DialogTitle>
                    <DialogDescription>
                        We'll fetch your actual electricity usage to calculate accurate savings
                    </DialogDescription>
                </DialogHeader>

                {step === 'api-key' && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="apiKey">Octopus API Key</Label>
                            <Input
                                id="apiKey"
                                type="password"
                                placeholder="sk_live_..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleApiKeySubmit()}
                            />
                            <p className="text-xs text-muted-foreground">
                                Find this in your{' '}
                                <a
                                    href="https://octopus.energy/dashboard/new/accounts/personal-details/api-access"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-amber-600 hover:underline inline-flex items-center gap-1"
                                >
                                    Octopus account dashboard
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </p>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button onClick={handleApiKeySubmit} disabled={!apiKey.trim() || loading} className="w-full">
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Finding your meters...
                                </>
                            ) : (
                                'Connect Account'
                            )}
                        </Button>
                    </div>
                )}

                {step === 'select-meter' && meters && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Connected! Found {meters.length} meter{meters.length > 1 ? 's' : ''}</span>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="meter">Select Your Property</Label>
                            <Select value={selectedMeter} onValueChange={setSelectedMeter}>
                                <SelectTrigger id="meter">
                                    <SelectValue placeholder="Choose your address..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {meters.map((meter) => (
                                        <SelectItem
                                            key={`${meter.mpan}|${meter.serialNumber}|${meter.postcode}`}
                                            value={`${meter.mpan}|${meter.serialNumber}|${meter.postcode}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">{meter.address}</span>
                                                <span className="text-xs text-muted-foreground">{meter.postcode}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {postcode && (
                            <p className="text-xs text-muted-foreground">
                                Solar data will be calculated for {postcode}
                            </p>
                        )}

                        <Button onClick={handleMeterSelect} disabled={!selectedMeter || !postcode} className="w-full">
                            <Zap className="h-4 w-4" />
                            Calculate My Savings
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
