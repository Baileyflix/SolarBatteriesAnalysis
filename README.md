# Solar + Battery ROI Calculator

A web application that helps UK households calculate the potential savings from installing solar PV panels and battery storage, using their actual electricity consumption data from Octopus Energy.

🌐 **Live Demo**: [solar-batteries-calculator.azurestaticapps.net](https://polite-plant-0ba640c03.1.azurestaticapps.net)

## Features

- **Real Consumption Data**: Connects to Octopus Energy API to fetch your actual half-hourly electricity usage
- **Location-Based Solar Estimates**: Uses NASA POWER satellite data to estimate solar generation for your postcode
- **Configurable System**: Adjust PV size (1-10 kWp), battery capacity (0-20 kWh), and tariff rates
- **Detailed Analysis**: Month-by-month breakdown of costs, savings, and energy flows
- **Visual Charts**: Interactive charts showing energy generation, consumption, and financial impact
- **Privacy First**: All calculations run in your browser - no data is stored on any server

## How It Works

1. **Connect Your Octopus Account**: Enter your API key to fetch 12 months of consumption history
2. **Enter Your Postcode**: We use this to get solar irradiance data for your location
3. **Configure Your System**: Set your PV size, battery capacity, and electricity tariffs
4. **View Results**: See potential savings, payback period, and detailed monthly analysis

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.9
- **Build**: Vite 7
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Charts**: Recharts
- **Hosting**: Azure Static Web Apps

## Data Sources

- **Consumption**: [Octopus Energy API](https://developer.octopus.energy/)
- **Solar Irradiance**: [NASA POWER](https://power.larc.nasa.gov/) (free, no API key required)
- **Postcode Lookup**: [postcodes.io](https://postcodes.io/) (free, no API key required)

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
```

## Privacy & Security

- Your Octopus API key is only used client-side and is never sent to our servers
- All energy calculations happen in your browser
- No personal data is collected or stored
- The app is open source - you can verify exactly what it does

## Limitations

- UK only (uses UK postcode lookup and Octopus Energy)
- Flat-rate tariffs only (no Agile/Tracker optimisation yet)
- Simple greedy battery dispatch (no price-aware scheduling)
- No EV or heat pump integration

## Licence

MIT
