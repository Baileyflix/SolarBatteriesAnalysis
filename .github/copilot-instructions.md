# Solar + Battery ROI Calculator - Project Guide

## Overview
React SPA for UK households to calculate solar PV + battery savings using actual Octopus Energy consumption data and NASA POWER solar estimates.

## Tech Stack
- React 19, TypeScript 5.9 (strict mode, ES2022)
- Vite 7, Tailwind CSS v4, shadcn/ui
- Recharts, Axios, Date-fns, Lucide React
- Playwright for E2E testing

## Project Structure
```
src/
├── types/          # Domain type definitions
├── services/       # API clients (Octopus, NASA POWER, postcodes.io)
├── lib/            # Calculation engines (solar, battery, cost)
├── hooks/          # React custom hooks
└── components/     # UI components
tests/
├── app.spec.ts           # Main app tests
├── config-panel.spec.ts  # Configuration panel tests
└── connection-dialog.spec.ts  # Octopus connection tests
```

## Key APIs
- **Octopus Energy GraphQL**: User's consumption data (requires API key)
- **NASA POWER**: Solar irradiance (free, CORS enabled)
- **postcodes.io**: UK postcode → lat/lng (free, CORS enabled)

## Key Formulas
Solar generation uses IEC 61724 / PVGIS methodology:
```
E = (G / G_STC) × P_peak × PR × Δt
```

## Development
```bash
npm install
npm run dev         # Development server with API proxy
npm run build       # Production build
npm test            # Run Playwright tests
npm run test:ui     # Run tests with Playwright UI
npm run test:headed # Run tests in visible browser
```

## UI Components
- **ScenarioConfigPanel**: Left panel with PV, battery, tariff configuration
- **SummaryMetrics**: Hero cards showing savings, payback, self-consumption
- **CostChart**: Monthly cost comparison bar chart
- **EnergyFlowChart**: Energy flows visualisation
- **ResultsTable**: Detailed monthly breakdown

## Tariff Presets
Located in `src/lib/cost-engine.ts`. Octopus Flux is marked as `recommended: true`.

## Deployment
Azure Static Web Apps via GitHub Actions. Push to main triggers automatic deployment.
