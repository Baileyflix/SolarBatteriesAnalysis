/**
 * ScenarioSelector - Toggle between Solar Only and Solar + Battery scenarios
 * 
 * Used in Energy and Data tabs to allow users to view different simulation outputs.
 */

interface ScenarioSelectorProps {
  selected: 'solarOnly' | 'withSolar';
  onSelect: (scenario: 'solarOnly' | 'withSolar') => void;
}

export function ScenarioSelector({ selected, onSelect }: ScenarioSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Showing:</span>
      <div className="flex rounded-lg border bg-muted p-1">
        <button
          onClick={() => onSelect('solarOnly')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            selected === 'solarOnly'
              ? 'bg-background shadow-sm font-medium'
              : 'hover:bg-background/50'
          }`}
        >
          Solar Only
        </button>
        <button
          onClick={() => onSelect('withSolar')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            selected === 'withSolar'
              ? 'bg-background shadow-sm font-medium'
              : 'hover:bg-background/50'
          }`}
        >
          Solar + Battery
        </button>
      </div>
    </div>
  );
}
