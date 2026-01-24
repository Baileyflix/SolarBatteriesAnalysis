# Solar + Battery ROI Calculator

A web application that helps UK households calculate the potential savings from installing solar PV panels and battery storage, using their actual electricity consumption data from Octopus Energy.

🌐 **Live Demo**: [solar-batteries-calculator.azurestaticapps.net](https://polite-plant-0ba640c03.1.azurestaticapps.net)

## Features

- **Real Consumption Data**: Connects to Octopus Energy API to fetch your actual half-hourly electricity usage
- **Location-Based Solar Estimates**: Uses NASA POWER satellite data to estimate solar generation for your postcode
- **Configurable System**: Adjust PV size (1-10 kWp), battery capacity (0-30 kWh), and tariff rates
- **Detailed Analysis**: Month-by-month breakdown of costs, savings, and energy flows
- **Visual Charts**: Interactive charts showing energy generation, consumption, and financial impact
- **Privacy First**: All calculations run in your browser - no data is stored on any server
- **Dark Mode**: Toggle between light and dark themes

## How It Works

1. **Connect Your Octopus Account**: Enter your API key to fetch 12 months of consumption history
2. **Enter Your Postcode**: We use this to get solar irradiance data for your location
3. **Configure Your System**: Set your PV size, battery capacity, and electricity tariffs
4. **View Results**: See potential savings, payback period, and detailed monthly analysis

### Calculation Methodology

The calculator uses the IEC 61724 / PVGIS methodology for solar generation:

```
E = (G / G_STC) × P_peak × PR × Δt
```

Where:
- **E** = Energy output (kWh)
- **G** = Global Horizontal Irradiance (W/m²)
- **G_STC** = 1000 W/m² (Standard Test Conditions)
- **P_peak** = System rated power (kWp)
- **PR** = Performance ratio (0.80-0.85 for UK)
- **Δt** = Time interval

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.9
- **Build**: Vite 7
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Charts**: Recharts
- **Testing**: Playwright
- **Hosting**: Azure Static Web Apps

## Data Sources

| Source | Data | Cost | CORS |
|--------|------|------|------|
| [Octopus Energy API](https://developer.octopus.energy/) | Half-hourly consumption | Free | Via GraphQL |
| [NASA POWER](https://power.larc.nasa.gov/) | Solar irradiance | Free | ✅ Yes |
| [postcodes.io](https://postcodes.io/) | UK postcode → lat/lng | Free | ✅ Yes |

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed
```

## Project Structure

```
src/
├── components/       # React UI components
│   ├── scenario-config-panel.tsx  # Left panel configuration
│   ├── summary-metrics.tsx        # Results summary cards
│   ├── cost-chart.tsx             # Monthly cost comparison chart
│   └── ...
├── hooks/            # React custom hooks
│   ├── use-consumption-data.ts    # Octopus API integration
│   ├── use-solar-data.ts          # NASA POWER integration
│   └── use-simulation.ts          # Simulation runner
├── lib/              # Core calculation engines
│   ├── solar-generator.ts         # PV generation calculator
│   ├── battery-engine.ts          # Battery simulation
│   └── cost-engine.ts             # Cost calculations
├── services/         # External API clients
│   ├── octopus-energy.ts          # Octopus GraphQL client
│   └── solar-data.ts              # NASA POWER + postcodes.io
└── types/            # TypeScript type definitions
```

## Privacy & Security

- Your Octopus API key is only used client-side and is never sent to any server
- All energy calculations happen in your browser
- No personal data is collected or stored
- No analytics or tracking

## Limitations

⚠️ **This is a hobby project — please get proper quotes before making decisions!**

- **UK only**: Uses UK postcode lookup and Octopus Energy API
- **Horizontal irradiance**: Real panels tilted at ~35° gain 10-15% more than our estimate
- **No shading analysis**: Trees and buildings can significantly reduce output
- **South-facing assumed**: Other orientations will produce less
- **Simple battery dispatch**: Uses "greedy" algorithm (solar first, then battery), not price-optimised for TOU tariffs
- **No degradation modelling**: Panels lose ~0.5% output per year
- **Simple payback**: Doesn't account for electricity price inflation or time value of money

**Always get quotes from MCS-certified installers** who can survey your property and give accurate figures for your specific situation.

## Licence

Feel free to use this code however you like. If you find bugs or have suggestions, please [open an issue](https://github.com/Chronickle/SolarBatteriesAnalysis/issues).
