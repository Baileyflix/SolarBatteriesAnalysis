import { Button } from '../../@/components/ui/button';
import { Zap, PlugZap } from 'lucide-react';

interface ConnectOverlayProps {
    onConnect: () => void;
}

export function ConnectOverlay({ onConnect }: ConnectOverlayProps) {
    return (
        <div className="absolute inset-0 z-10 flex items-start justify-center pt-20 lg:pt-32">
            <div className="text-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border max-w-md mx-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-full w-fit mx-auto mb-4">
                    <Zap className="h-8 w-8 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold mb-2">See Your Personalised Savings</h2>
                <p className="text-muted-foreground mb-6">
                    Connect your Octopus Energy account to calculate savings based on your actual usage patterns
                </p>
                <Button onClick={onConnect} size="lg">
                    <PlugZap className="h-4 w-4" />
                    Connect to Octopus Energy
                </Button>
            </div>
        </div>
    );
}
