import { Button } from '../../@/components/ui/button';
import { HowItWorksDialog } from '@/components/how-it-works-dialog';
import { Zap, Moon, Sun } from 'lucide-react';

interface AppHeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function AppHeader({ isDark, onToggleTheme }: AppHeaderProps) {
  return (
    <header className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 dark:from-amber-600 dark:via-orange-600 dark:to-amber-700">
      <div className="container mx-auto px-4 py-5 md:px-8 md:py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-white/10 rounded-xl flex-shrink-0">
              <Zap className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-white drop-shadow-sm truncate">
                Solar + Battery Calculator
              </h1>
              <p className="text-amber-50/80 text-xs sm:text-sm hidden sm:block">
                Calculate savings using your actual usage data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HowItWorksDialog />
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleTheme}
              className="text-white/90 hover:text-white hover:bg-white/10"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
