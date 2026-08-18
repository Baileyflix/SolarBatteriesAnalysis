import { useCallback, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../@/components/ui/tabs';
import { SummaryMetrics } from '@/components/summary-metrics';
import { CostChart } from '@/components/cost-chart';
import { ResultsTable } from '@/components/results-table';
import { EnergyFlowChart } from '@/components/energy-flow-chart';
import { ScenarioConfigPanel } from '@/components/scenario-config-panel';
import { ScenarioSelector } from '@/components/scenario-selector';
import { OctopusConnectDialog } from '@/components/octopus-connect-dialog';
import { AppHeader } from '@/components/app-header';
import { AppFooter } from '@/components/app-footer';
import { ConnectionStatusCard } from '@/components/connection-status-card';
import { StaleResultsWarning } from '@/components/stale-results-warning';
import { ConnectOverlay } from '@/components/connect-overlay';
import { useConsumptionData } from '@/hooks/use-consumption-data';
import { useSolarData } from '@/hooks/use-solar-data';
import { useSimulation } from '@/hooks/use-simulation';
import { useOctopusSolarEstimate } from '@/hooks/use-octopus-solar-estimate';
import { useActualTariff } from '@/hooks/use-actual-tariff';
import { useActualTariffEffect } from '@/hooks/use-actual-tariff-effect';
import { useTariffSelection } from '@/hooks/use-tariff-selection';
import { useAppState } from '@/hooks/use-app-state';
import { useConfigChangeDetection, usePvSystemChangeDetection } from '@/hooks/use-config-change-detection';
import { AlertCircle, Loader2, BarChart3, Activity, Table } from 'lucide-react';
import { Badge } from '../@/components/ui/badge';
import type { AnnualFinancialSummary, ScenarioType } from '@/types';

/** Pick the right annual summary for the currently selected scenario */
function getAnnualSummaryForScenario(
  scenario: ScenarioType,
  results: {
    baseline: AnnualFinancialSummary;
    solarOnly: AnnualFinancialSummary;
    batteryOnly: AnnualFinancialSummary;
    withSolar: AnnualFinancialSummary;
  }
): AnnualFinancialSummary {
  switch (scenario) {
    case 'baseline': return results.baseline;
    case 'solarOnly': return results.solarOnly;
    case 'batteryOnly': return results.batteryOnly;
    case 'withSolar': return results.withSolar;
  }
}

function App() {
  // Centralized app state management
  const appState = useAppState();
  const {
    connection,
    storedData,
    liveTariffRates,
    config: scenarioConfig,
    ui,
    actions,
  } = appState;

  // Data fetching hooks
  const consumptionData = useConsumptionData();
  const solarData = useSolarData();
  const simulation = useSimulation();
  const octopusSolarEstimate = useOctopusSolarEstimate();
  const actualTariff = useActualTariff();

  // Config change detection hooks
  const configChangeDetection = useConfigChangeDetection(scenarioConfig, connection.isConnected);
  const pvChangeDetection = usePvSystemChangeDetection(scenarioConfig.pvSystem, storedData.hasStoredGeneration);

  // Tariff selection (switching between presets and user's actual tariff)
  const tariffSelection = useTariffSelection({
    scenarioConfig,
    importTariff: actualTariff.importTariff,
    exportTariff: actualTariff.exportTariff,
    setConfig: actions.setConfig,
  });

  // Handle actual tariff fetch → store → re-simulate flow
  const actualTariffEffect = useActualTariffEffect({
    importTariff: actualTariff.importTariff,
    exportTariff: actualTariff.exportTariff,
    loading: actualTariff.loading,
    isConnected: connection.isConnected,
    consumption: storedData.consumption,
    generation: storedData.generation,
    storedActualTariffConfig: storedData.actualTariffConfig,
    scenarioConfig,
    storeActualTariffConfig: actions.storeActualTariffConfig,
    runSimulation: simulation.runSimulation,
  });

  // Recalculate everything - regenerate solar if needed, then run simulation
  const handleRecalculate = useCallback(async () => {
    if (!storedData.postcode || !storedData.dateRange || !storedData.consumption) return;

    let generationToUse = storedData.generation;

    // Regenerate solar data if PV system changed
    if (pvChangeDetection.needsRegeneration || !storedData.generation) {
      const newGeneration = await solarData.generateData({
        postcode: storedData.postcode,
        periodFrom: storedData.dateRange.from,
        periodTo: storedData.dateRange.to,
        systemConfig: scenarioConfig.pvSystem,
      });

      if (newGeneration) {
        actions.storeGeneration(newGeneration);
        pvChangeDetection.markAsRegenerated();
        generationToUse = newGeneration;
      }
    }

    // Run simulation with current config
    if (generationToUse) {
      simulation.runSimulation({
        consumption: storedData.consumption,
        generation: generationToUse,
        battery: scenarioConfig.battery,
        tariff: scenarioConfig.tariff,
        monthlyDirectDebitPounds: scenarioConfig.monthlyDirectDebit || undefined,
        pvSystemCostPounds: scenarioConfig.pvSystemCost || undefined,
        batteryCostPounds: scenarioConfig.batteryCost || undefined,
        allowBatteryOnlyExport: scenarioConfig.batteryOnlyAllowExport,
        actualTariff: storedData.actualTariffConfig ?? undefined,
        actualTariffRates: actualTariff.importTariff?.halfHourlyRates ?? undefined,
      });

      // Mark config as calculated (clears the hasChanged flag)
      configChangeDetection.markAsCalculated();
    }
  }, [storedData.postcode, storedData.dateRange, scenarioConfig, storedData.consumption, storedData.generation, pvChangeDetection, solarData, simulation, storedData.actualTariffConfig, actualTariff.importTariff?.halfHourlyRates, configChangeDetection, actions]);

  // Restore simulation results from a persisted session on reload - the
  // connection/consumption/generation data is rehydrated by useAppState()
  // directly from localStorage, but the simulation itself (a separate hook)
  // starts empty each mount and needs to be re-run once from that cached data.
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (hasHydratedRef.current) return;
    if (!connection.isConnected || !storedData.consumption || !storedData.generation) return;

    hasHydratedRef.current = true;
    simulation.runSimulation({
      consumption: storedData.consumption,
      generation: storedData.generation,
      battery: scenarioConfig.battery,
      tariff: scenarioConfig.tariff,
      monthlyDirectDebitPounds: scenarioConfig.monthlyDirectDebit || undefined,
      pvSystemCostPounds: scenarioConfig.pvSystemCost || undefined,
      batteryCostPounds: scenarioConfig.batteryCost || undefined,
      allowBatteryOnlyExport: scenarioConfig.batteryOnlyAllowExport,
      actualTariff: storedData.actualTariffConfig ?? undefined,
      actualTariffRates: actualTariff.importTariff?.halfHourlyRates ?? undefined,
    });
    configChangeDetection.markAsCalculated();
  }, [connection.isConnected, storedData.consumption, storedData.generation, scenarioConfig, storedData.actualTariffConfig, actualTariff.importTariff?.halfHourlyRates, simulation, configChangeDetection]);

  // Handle connection from dialog
  const handleConnect = async (data: {
    apiKey: string;
    accountNumber: string;
    mpan: string;
    serialNumber: string;
    postcode: string;
    dateRange: { from: string; to: string };
  }) => {
    // Store data for later re-simulation
    actions.storeConnectionData({
      apiKey: data.apiKey,
      accountNumber: data.accountNumber,
      mpan: data.mpan,
      serialNumber: data.serialNumber,
      postcode: data.postcode,
      dateRange: data.dateRange,
    });

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

    // Fetch user's actual tariff from their account (non-blocking)
    // Include date range so we can fetch half-hourly rates for TOU tariffs
    if (data.accountNumber) {
      actualTariff.fetchTariff(data.apiKey, data.accountNumber, {
        from: new Date(data.dateRange.from),
        to: new Date(data.dateRange.to),
      });
    }

    // Store the fetched data
    if (consumptionResult) {
      actions.storeConsumption(consumptionResult);
    }
    if (solarResult) {
      actions.storeGeneration(solarResult);
    }

    // Run simulation if both datasets loaded successfully
    if (consumptionResult && solarResult) {
      simulation.runSimulation({
        consumption: consumptionResult,
        generation: solarResult,
        battery: scenarioConfig.battery,
        tariff: scenarioConfig.tariff,
        monthlyDirectDebitPounds: scenarioConfig.monthlyDirectDebit,
        pvSystemCostPounds: scenarioConfig.pvSystemCost,
        batteryCostPounds: scenarioConfig.batteryCost,
        allowBatteryOnlyExport: scenarioConfig.batteryOnlyAllowExport,
      });
      actions.setConnected(true);
      // Mark config as calculated
      configChangeDetection.markAsCalculated();
    }
  };

  // Handle disconnect - clear all data
  const handleDisconnect = useCallback(() => {
    // Use centralized disconnect action
    actions.disconnect();
    // Reset config change detection hooks
    configChangeDetection.reset();
    pvChangeDetection.reset();
    actualTariffEffect.reset();
    // Reset data fetching hooks
    simulation.reset();
    octopusSolarEstimate.reset();
    actualTariff.reset();
  }, [actions, simulation, octopusSolarEstimate, actualTariff, configChangeDetection, pvChangeDetection, actualTariffEffect]);

  const loading = consumptionData.loading || solarData.loading || simulation.loading;
  const error = consumptionData.error || solarData.error || simulation.error;
  const hasResults = simulation.comparison !== null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader isDark={ui.isDark} onToggleTheme={actions.toggleTheme} />

      <div className="container mx-auto p-3 sm:p-4 md:p-8 flex-1 relative">
        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Error</h3>
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        <div className={`grid gap-6 lg:grid-cols-3 transition-all duration-300 ${!connection.isConnected ? 'blur-sm pointer-events-none select-none' : ''}`}>
          {/* Left Column - Configuration */}
          <div className="lg:col-span-1 space-y-4">
            {/* Connection Status Card - only shown when connected */}
            {connection.isConnected && (
              <ConnectionStatusCard
                postcode={storedData.postcode}
                dateRange={storedData.dateRange}
                onDisconnect={handleDisconnect}
              />
            )}

            {/* Scenario Configuration */}
            <ScenarioConfigPanel
              config={scenarioConfig}
              onChange={actions.setConfig}
              onRunSimulation={connection.isConnected ? handleRecalculate : undefined}
              isLoading={solarData.loading || simulation.loading}
              hasChanges={configChangeDetection.hasChanged || pvChangeDetection.needsRegeneration}
              actualTariff={tariffSelection.actualTariffInfo}
              onUseMyTariff={tariffSelection.selectActualTariff}
              liveRates={liveTariffRates.rates}
              liveRatesRegion={liveTariffRates.region}
            />
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2 relative min-h-[500px]">
            {/* Stale Results Warning */}
            {(configChangeDetection.hasChanged || pvChangeDetection.needsRegeneration) && connection.isConnected && hasResults && !loading && (
              <StaleResultsWarning onRecalculate={handleRecalculate} loading={loading} />
            )}

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
              <Tabs value={ui.activeTab} onValueChange={actions.setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 h-auto">
                  <TabsTrigger value="results" className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 text-xs sm:text-sm">
                    <BarChart3 className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden xs:inline">Results</span>
                  </TabsTrigger>
                  <TabsTrigger value="energy" className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 text-xs sm:text-sm">
                    <Activity className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden xs:inline">Energy</span>
                  </TabsTrigger>
                  <TabsTrigger value="breakdown" className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 text-xs sm:text-sm">
                    <Table className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden xs:inline">Data</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="space-y-6">
                  {/* Data Source Legend */}
                  <div className="flex flex-wrap gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg text-xs sm:text-sm">
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

                  {hasResults && simulation.comparison && simulation.baseline && simulation.withSolar ? (
                    <>
                      <SummaryMetrics
                        baseline={simulation.baseline}
                        withSolar={simulation.withSolar}
                        solarOnly={simulation.solarOnly}
                        batteryOnly={simulation.batteryOnly}
                        withSolarComparison={simulation.withSolarComparison}
                        withSolarRoi={simulation.withSolarRoi}
                        solarOnlyComparison={simulation.solarOnlyComparison}
                        solarOnlyRoi={simulation.solarOnlyRoi}
                        batteryOnlyComparison={simulation.batteryOnlyComparison}
                        batteryOnlyRoi={simulation.batteryOnlyRoi}
                        actualTariff={actualTariff.importTariff}
                        actualSpend={simulation.actualSpend}
                      />

                      {simulation.baseline && simulation.withSolar && (
                        <CostChart
                          baseline={simulation.baseline.monthlyBreakdown}
                          solarOnly={simulation.solarOnly?.monthlyBreakdown}
                          batteryOnly={simulation.batteryOnly?.monthlyBreakdown}
                          withSolar={simulation.withSolar.monthlyBreakdown}
                          actualSpend={simulation.actualSpend?.monthlyBreakdown}
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
                  {simulation.baseline && simulation.solarOnly && simulation.batteryOnly && simulation.withSolar && (
                    <ScenarioSelector
                      selected={ui.selectedScenario}
                      onSelect={actions.setSelectedScenario}
                      showBaseline={true}
                      showBatteryOnly={true}
                    />
                  )}
                  {simulation.baseline && simulation.solarOnly && simulation.batteryOnly && simulation.withSolar ? (
                    <EnergyFlowChart
                      monthlyData={getAnnualSummaryForScenario(ui.selectedScenario, {
                        baseline: simulation.baseline,
                        solarOnly: simulation.solarOnly,
                        batteryOnly: simulation.batteryOnly,
                        withSolar: simulation.withSolar,
                      }).monthlyBreakdown}
                      scenario={ui.selectedScenario}
                    />
                  ) : (
                    <div className="h-96 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg animate-pulse" />
                  )}
                </TabsContent>

                <TabsContent value="breakdown" className="space-y-6">
                  {simulation.baseline && simulation.solarOnly && simulation.batteryOnly && simulation.withSolar && (
                    <ScenarioSelector
                      selected={ui.selectedScenario}
                      onSelect={actions.setSelectedScenario}
                      showBaseline={true}
                      showBatteryOnly={true}
                    />
                  )}
                  {simulation.baseline && simulation.solarOnly && simulation.batteryOnly && simulation.withSolar ? (() => {
                    const scenarioSummary = getAnnualSummaryForScenario(ui.selectedScenario, {
                      baseline: simulation.baseline,
                      solarOnly: simulation.solarOnly,
                      batteryOnly: simulation.batteryOnly,
                      withSolar: simulation.withSolar,
                    });
                    return (
                      <ResultsTable
                        monthlyData={scenarioSummary.monthlyBreakdown}
                        dailyBreakdown={scenarioSummary.dailyBreakdown}
                        actualSpendMonthly={simulation.actualSpend?.monthlyBreakdown}
                        scenario={ui.selectedScenario}
                      />
                    );
                  })() : (
                    <div className="h-96 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg animate-pulse" />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>

        {/* Overlay CTA when not connected */}
        {!connection.isConnected && !loading && (
          <ConnectOverlay onConnect={actions.openConnectDialog} />
        )}
      </div>

      <AppFooter />

      {/* Connection Dialog */}
      <OctopusConnectDialog
        open={connection.dialogOpen}
        onOpenChange={actions.setConnectDialogOpen}
        onConnect={handleConnect}
      />
    </div>
  );
}

export default App;
