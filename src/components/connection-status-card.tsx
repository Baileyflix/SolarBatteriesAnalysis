import { Button } from '../../@/components/ui/button';
import { PlugZap, LogOut, Calendar } from 'lucide-react';

interface ConnectionStatusCardProps {
    postcode: string | null;
    dateRange: { from: string; to: string } | null;
    onDisconnect: () => void;
}

export function ConnectionStatusCard({
    postcode,
    dateRange,
    onDisconnect,
}: ConnectionStatusCardProps) {
    return (
        <div className="p-4 rounded-lg border-2 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 rounded-full">
                        <PlugZap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                            Connected to Octopus
                        </p>
                        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                            <span>{postcode}</span>
                            {dateRange && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(dateRange.from).toLocaleDateString('en-GB', {
                                        month: 'short',
                                        year: '2-digit',
                                    })}
                                    {' - '}
                                    {new Date(dateRange.to).toLocaleDateString('en-GB', {
                                        month: 'short',
                                        year: '2-digit',
                                    })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onDisconnect}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                    <LogOut className="h-3 w-3 mr-1" />
                    Disconnect
                </Button>
            </div>
        </div>
    );
}
