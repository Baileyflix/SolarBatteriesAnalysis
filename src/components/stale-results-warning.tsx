import { Button } from '../../@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface StaleResultsWarningProps {
    onRecalculate: () => void;
    loading: boolean;
}

export function StaleResultsWarning({ onRecalculate, loading }: StaleResultsWarningProps) {
    return (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                    Settings changed — results may be outdated
                </span>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={onRecalculate}
                disabled={loading}
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
                <RefreshCw className="h-3 w-3 mr-1" />
                Update
            </Button>
        </div>
    );
}
