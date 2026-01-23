import { useState, useCallback, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../@/components/ui/tabs';
import { Button } from '../@/components/ui/button';
import { SummaryMetrics } from '@/components/summary-metrics';
import { CostChart } from '@/components/cost-chart';
import { ResultsTable } from '@/components/results-table';
import { EnergyFlowChart } from '@/components/energy-flow-chart';
import { ScenarioConfigPanel, type ScenarioConfig } from '@/components/scenario-config-panel';
import { OctopusConnectDialog } from '@/components/octopus-connect-dialog';
import { HowItWorksDialog } from '@/components/how-it-works-dialog';
import { LegalDialogs } from '@/components/legal-dialogs';
import { useConsumptionData } from '@/hooks/use-consumption-data';
import { useSolarData } from '@/hooks/use-solar-data';
import { useSimulation } from '@/hooks/use-simulation';
import { useOctopusSolarEstimate } from '@/hooks/use-octopus-solar-estimate';
import { AlertCircle, Zap, RefreshCw, Loader2, PlugZap, LogOut, Moon, Sun, BarChart3, Activity, Table, Github, Calendar } from 'lucide-react';
import { Badge } from '../@/components/ui/badge';
import { UK_BATTERY_PRESETS } from '@/lib/battery-engine';
import { UK_PV_PRESETS } from '@/lib/solar-generator';
import { UK_TARIFF_PRESETS } from '@/lib/cost-engine';
import type { PVSystemConfig, ConsumptionTimeSeries, GenerationTimeSeries } from '@/types';

// Default scenario configuration
function createDefaultConfig(): ScenarioConfig {
  return {
    pvPreset: 'medium',
    pvSystem: {
      systemSizeKwp: UK_PV_PRESETS.medium.systemSizeKwp,
      performanceRatio: UK_PV_PRESETS.medium.performanceRatio,
    },
    batteryPreset: 'medium',
    battery: { ...UK_BATTERY_PRESETS.medium },
    tariffPreset: 'octopusFlux',
    tariff: {
      import: { ...UK_TARIFF_PRESETS.octopusFlux.import },
      export: { ...UK_TARIFF_PRESETS.octopusFlux.export },
    },
    systemCost: 10000,
    monthlyDirectDebit: 150,
  };
}

function App() {
  // Data fetching hooks
  const consumptionData = useConsumptionData();
  const solarData = useSolarData();
  const simulation = useSimulation();
  const octopusSolarEstimate = useOctopusSolarEstimate();

  // Connection dialog state
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  // Store fetched data for re-simulation
  const [storedConsumption, setStoredConsumption] = useState<ConsumptionTimeSeries | null>(null);
  const [storedGeneration, setStoredGeneration] = useState<GenerationTimeSeries | null>(null);
  const [storedPostcode, setStoredPostcode] = useState<string>('');
  const [storedDateRange, setStoredDateRange] = useState<{ from: string; to: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Scenario configuration for dynamic adjustments
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig>(createDefaultConfig);

  // Track if we need to regenerate solar data (when PV system changes)
  const [needsRegeneration, setNeedsRegeneration] = useState(false);
  const previousPvSystemRef = useRef<PVSystemConfig | null>(null);

  // Track active tab
  const [activeTab, setActiveTab] = useState('results');

  // Theme toggle
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Check if PV system config changed (needs new solar generation)
  useEffect(() => {
    if (previousPvSystemRef.current && storedGeneration) {
      const prevSize = previousPvSystemRef.current.systemSizeKwp;
      const newSize = scenarioConfig.pvSystem.systemSizeKwp;
      const prevRatio = previousPvSystemRef.current.performanceRatio;
      const newRatio = scenarioConfig.pvSystem.performanceRatio;

      if (prevSize !== newSize || prevRatio !== newRatio) {
        setNeedsRegeneration(true);
      }
    }
    previousPvSystemRef.current = scenarioConfig.pvSystem;
  }, [scenarioConfig.pvSystem, storedGeneration]);

  // Re-run simulation when scenario config changes (if we have data)
  useEffect(() => {
    if (storedConsumption && storedGeneration && !needsRegeneration) {
      simulation.runSimulation({
        consumption: storedConsumption,
        generation: storedGeneration,
        battery: scenarioConfig.battery,
        tariff: scenarioConfig.tariff,
        monthlyDirectDebitPounds: scenarioConfig.monthlyDirectDebit || undefined,
        systemCostPounds: scenarioConfig.systemCost || undefined,
      });
    }
  }, [scenarioConfig.battery, scenarioConfig.tariff, scenarioConfig.monthlyDirectDebit, scenarioConfig.systemCost, storedConsumption, storedGeneration, needsRegeneration]);

  // Regenerate solar data when PV system changes
  const handleRegenerateSolar = useCallback(async () => {
    if (!storedPostcode || !storedDateRange) return;

    const newGeneration = await solarData.generateData({
      postcode: storedPostcode,
      periodFrom: storedDateRange.from,
      periodTo: storedDateRange.to,
      systemConfig: scenarioConfig.pvSystem,
    });

    if (newGeneration) {
      setStoredGeneration(newGeneration);
      setNeedsRegeneration(false);

      // Re-run simulation with new generation data
      if (storedConsumption) {
        simulation.runSimulation({
          consumption: storedConsumption,
          generation: newGeneration,
          battery: scenarioConfig.battery,
          tariff: scenarioConfig.tariff,
          monthlyDirectDebitPounds: scenarioConfig.monthlyDirectDebit || undefined,
          systemCostPounds: scenarioConfig.systemCost || undefined,
        });
      }
    }
  }, [storedPostcode, storedDateRange, scenarioConfig, storedConsumption, solarData, simulation]);

  // Handle connection from dialog
  const handleConnect = async (data: {
    apiKey: string;
    mpan: string;
    serialNumber: string;
    postcode: string;
    dateRange: { from: string; to: string };
  }) => {
    // Store data for later re-simulation
    setStoredPostcode(data.postcode);
    setStoredDateRange(data.dateRange);

    // Fetch consumption data and solar data in parallel
    // Also fetch Octopus solar estimate (non-blocking)
    const [consumptionResult, solarResult] = await Promise.all([
      consumptionData.fetchData({
        apiKey: data.apiKey,
        mpan: data.mpan,
        serialNumber: data.serialNumber,
        periodFrom: data.dateRange.from,
        periodTo: data.dateRange.to,
      }),
      solarData.generateData({
        postcode: data.postcode,
        periodFrom: data.dateRange.from,
        periodTo: data.dateRange.to,
        systemConfig: scenarioConfig.pvSystem,
      }),
    ]);

    // Fetch Octopus's own solar estimate for comparison (non-blocking)
    octopusSolarEstimate.fetchEstimate(data.apiKey, data.postcode);

    // Store the fetched data
    if (consumptionResult) {
      setStoredConsumption(consumptionResult);
    }
    if (solarResult) {
      setStoredGeneration(solarResult);
      previousPvSystemRef.current = scenarioConfig.pvSystem;
    }

    // Run simulation if both datasets loaded successfully
    if (consumptionResult && solarResult) {
      simulation.runSimulation({
        consumption: consumptionResult,
        generation: solarResult,
        battery: scenarioConfig.battery,
        tariff: scenarioConfig.tariff,
        monthlyDirectDebitPounds: scenarioConfig.monthlyDirectDebit,
        systemCostPounds: scenarioConfig.systemCost,
      });
      setIsConnected(true);
    }
  };

  // Handle disconnect - clear all data
  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setStoredConsumption(null);
    setStoredGeneration(null);
    setStoredPostcode('');
    setStoredDateRange(null);
    setNeedsRegeneration(false);
    previousPvSystemRef.current = null;
    setScenarioConfig(createDefaultConfig());
    simulation.reset();
    octopusSolarEstimate.reset();
    // Clear any localStorage if we ever store anything
    localStorage.removeItem('solar-calculator-preferences');
  }, [simulation, octopusSolarEstimate]);

  // Handle scenario config changes
  const handleScenarioChange = useCallback((newConfig: ScenarioConfig) => {
    setScenarioConfig(newConfig);
  }, []);

  const loading = consumptionData.loading || solarData.loading || simulation.loading;
  const error = consumptionData.error || solarData.error || simulation.error;
  const hasResults = simulation.comparison !== null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with gradient */}
      <header className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 dark:from-amber-600 dark:via-orange-600 dark:to-amber-700">
        <div className="container mx-auto px-4 py-5 md:px-8 md:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-sm">Solar + Battery Calculator</h1>
                <p className="text-amber-50/80 text-sm hidden md:block">
                  Calculate savings using your actual usage data
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HowItWorksDialog />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDark(!isDark)}
                className="text-white/90 hover:text-white hover:bg-white/10"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 md:p-8 flex-1 relative">
        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Error</h3>
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        <div className={`grid gap-6 lg:grid-cols-3 transition-all duration-300 ${!isConnected ? 'blur-sm pointer-events-none select-none' : ''}`}>
          {/* Left Column - Configuration */}
          <div className="lg:col-span-1 space-y-4">
            {/* Connection Status Card - only shown when connected */}
            {isConnected && (
              <div className="p-4 rounded-lg border-2 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 rounded-full">
                      <PlugZap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Connected to Octopus</p>
                      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                        <span>{storedPostcode}</span>
                        {storedDateRange && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(storedDateRange.from).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                            {' - '}
                            {new Date(storedDateRange.to).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  >
                    <LogOut className="h-3 w-3 mr-1" />
                    Disconnect
                  </Button>
                </div>
              </div>
            )}

            {/* Scenario Configuration */}
            <ScenarioConfigPanel
              config={scenarioConfig}
              onChange={handleScenarioChange}
              onRunSimulation={isConnected ? handleRegenerateSolar : undefined}
              isLoading={solarData.loading || simulation.loading}
              hasChanges={needsRegeneration}
            />

            {/* Regeneration Warning - Only show when solar specifically needs recalc */}
            {needsRegeneration && isConnected && !solarData.loading && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
                <div className="flex items-start gap-3">
                  <RefreshCw className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      PV system size changed
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Solar generation needs to be recalculated.
                    </p>
                    <button
                      onClick={handleRegenerateSolar}
                      disabled={solarData.loading}
                      className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 underline"
                    >
                      {solarData.loading ? 'Regenerating...' : 'Recalculate Solar Generation'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2 relative min-h-[500px]">
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center p-12 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-amber-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {consumptionData.loading && 'Fetching your usage data...'}
                    {solarData.loading && 'Calculating solar generation...'}
                    {simulation.loading && 'Running simulation...'}
                  </p>
                </div>
              </div>
            )}

            {/* Results Content */}
            {!loading && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="results" className="flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Results</span>
                  </TabsTrigger>
                  <TabsTrigger value="energy" className="flex items-center gap-1.5">
                    <Activity className="h-4 w-4" />
                    <span className="hidden sm:inline">Energy</span>
                  </TabsTrigger>
                  <TabsTrigger value="breakdown" className="flex items-center gap-1.5">
                    <Table className="h-4 w-4" />
                    <span className="hidden sm:inline">Breakdown</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="space-y-6">
                  {/* Data Source Legend */}
                  <div className="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-slate-700 bg-slate-100">
                        Your Usage
                      </Badge>
                      <span className="text-muted-foreground">actual consumption from Octopus</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300">
                        Estimated Bills
                      </Badge>
                      <span className="text-muted-foreground">based on real weather + solar setup</span>
                    </div>
                  </div>

                  {hasResults && simulation.comparison ? (
                    <>
                      <SummaryMetrics
                        comparison={simulation.comparison}
                        roi={simulation.roi}
                        octopusEstimate={octopusSolarEstimate.estimate}
                        pvSystemSizeKwp={scenarioConfig.pvSystem.systemSizeKwp}
                        solarOnly={simulation.solarOnly}
                      />

                      {simulation.baseline && simulation.withSolar && (
                        <CostChart
                          baseline={simulation.baseline.monthlyBreakdown}
                          solarOnly={simulation.solarOnly?.monthlyBreakdown}
                          withSolar={simulation.withSolar.monthlyBreakdown}
                        />
                      )}
                    </>
                  ) : (
                    // Placeholder content when not connected
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg animate-pulse" />
                        ))}
                      </div>
                      <div className="h-80 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg animate-pulse" />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="energy" className="space-y-6">
                  {simulation.withSolar ? (
                    <EnergyFlowChart monthlyData={simulation.withSolar.monthlyBreakdown} />
                  ) : (
                    <div className="h-96 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg animate-pulse" />
                  )}
                </TabsContent>

                <TabsContent value="breakdown" className="space-y-6">
                  {simulation.withSolar ? (
                    <ResultsTable monthlyData={simulation.withSolar.monthlyBreakdown} />
                  ) : (
                    <div className="h-96 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg animate-pulse" />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>

        {/* Overlay CTA when not connected - positioned over entire content area */}
        {!isConnected && !loading && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-20 lg:pt-32">
            <div className="text-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border max-w-md mx-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-full w-fit mx-auto mb-4">
                <Zap className="h-8 w-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">See Your Personalised Savings</h2>
              <p className="text-muted-foreground mb-6">
                Connect your Octopus Energy account to calculate savings based on your actual usage patterns
              </p>
              <Button onClick={() => setConnectDialogOpen(true)} size="lg">
                <PlugZap className="h-4 w-4" />
                Connect to Octopus Energy
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
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

      {/* Connection Dialog */}
      <OctopusConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnect={handleConnect}
      />
    </div>
  );
}

export default App;
