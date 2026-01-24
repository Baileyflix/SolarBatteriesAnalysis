import { LegalDialogs } from '@/components/legal-dialogs';
import { Github } from 'lucide-react';

export function AppFooter() {
    return (
        <footer className="border-t bg-muted/30 py-4 mt-auto">
            <div className="container mx-auto px-4 md:px-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
                    <p className="text-center sm:text-left">
                        ⚠️ Estimates only — do your own research before making decisions.{' '}
                        <LegalDialogs trigger={<button className="underline hover:text-foreground">More info</button>} />
                    </p>
                    <div className="flex items-center gap-3">
                        <a
                            href="https://github.com/Chronickle/SolarBatteriesAnalysis"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                            <Github className="h-4 w-4" />
                            <span className="hidden sm:inline">Source</span>
                        </a>
                        <span className="text-xs">v1.0.0</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
