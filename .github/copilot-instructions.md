# Solar Batteries Analysis SPA - Project Instructions

## Project Overview
Single Page Application for analyzing solar panel and battery ROI using real energy data from Octopus Energy API and solar irradiance data.

**Purpose:** Help UK households calculate the financial impact of installing solar PV panels and battery storage by simulating 12 months of energy flows using their actual historical consumption data.

## Tech Stack
- React 19 with TypeScript 5.9 (ES2022 target)
- Vite 7 for build tooling
- Tailwind CSS v4 + shadcn/ui for styling
- Recharts for data visualization
- Axios for API calls
- Date-fns for date handling
- Lucide React for icons

## Architecture Principles
- **Modular & Testable:** Each stage builds isolated, composable modules with clear inputs/outputs
- **Type-Safe:** TypeScript strict mode, no `any` types, discriminated unions for state machines
- **Separation of Concerns:** UI components / business logic / API clients kept separate
- **Transparent Calculations:** All simulation logic deterministic and reproducible (no black-box ML)
- **Security First:** API keys in environment variables, input validation, proper error handling

## Project Structure
```
src/
├── types/              # Domain type definitions
│   ├── consumption.ts  # Half-hourly consumption records
│   ├── generation.ts   # PV generation data types
│   ├── battery.ts      # Battery state models
│   ├── tariff.ts       # Grid tariff structures
│   └── financial.ts    # Monthly financial summaries
├── services/           # API integration layer
│   ├── octopus-energy.ts    # Octopus API client
│   └── solar-data.ts        # Solar irradiance fetcher
├── lib/                # Core calculation engines
│   ├── solar-generator.ts   # PV generation modeling
│   ├── battery-engine.ts    # Battery dispatch logic
│   ├── cost-engine.ts       # Tariff & cost calculations
│   └── simulator.ts         # Main orchestrator
├── hooks/              # React custom hooks
│   ├── use-consumption-data.ts
│   ├── use-solar-data.ts
│   └── use-simulation.ts
└── components/         # React UI components
    ├── ui/             # shadcn/ui components
    ├── simulation-form.tsx
    ├── cost-chart.tsx
    ├── results-table.tsx
    └── summary-metrics.tsx
```

## Key Features (7-Stage Implementation)

### Stage 1: Domain Types ✅ (Next)
- Half-hourly consumption records (timestamp, kWh)
- PV generation time series
- Battery state (SoC, charge/discharge power)
- Tariff rate structures (import/export £/kWh)
- Monthly financial summaries (cost, savings, balance)

### Stage 2: Octopus Energy API Integration
- Authenticate with API key
- Fetch 12 months half-hourly consumption data
- Normalize into ordered time series
- Error handling & loading states

### Stage 3: Solar Generation Model
- Fetch location-based historical irradiance data
- Calculate PV output: irradiance → kWh (with system size, performance ratio)
- Half-hourly resolution matching UK settlement periods

### Stage 4: Battery Dispatch Engine
- Track state of charge (SoC) per interval
- Apply charge/discharge power limits
- Model round-trip efficiency
- Priority: PV → load → battery → grid → import

### Stage 5: Tariff & Cost Engine
- Calculate import costs per half-hour
- Calculate export revenue (SEG payments)
- Support flat-rate tariffs (v1)
- Daily and monthly aggregation

### Stage 6: Monthly Direct Debit Comparison
- Monthly net cost vs. fixed direct debit amount
- Running balance (credit/debit tracking)
- Cumulative savings calculation
- ROI metrics: simple payback period

### Stage 7: Web UI & Visualization
- Form inputs: API key, MPAN, location, system specs, tariffs
- Interactive charts: monthly costs, energy flows, cumulative savings
- Results table with monthly breakdown
- Annual summary and payback estimate

## Development Guidelines

### TypeScript
- Use ES modules only (no CommonJS)
- Target ES2022, leverage modern features (top-level await, class fields)
- Avoid `any`, prefer `unknown` with type narrowing
- Discriminated unions for state machines
- Kebab-case filenames (e.g., `battery-engine.ts`)
- Explicit return types for exported functions

### React
- Functional components with hooks only
- TypeScript interfaces for all props and state
- Custom hooks for reusable stateful logic
- Proper loading, error, and success states
- Component composition over inheritance
- Accessibility: semantic HTML, ARIA attributes
- Mobile-first responsive design

### Security (OWASP)
- Never hardcode API keys (use `import.meta.env.VITE_*`)
- Validate all user inputs
- HTTPS for all external API calls
- Sanitize error messages (no sensitive data leaks)
- Use parameterized queries/safe data handling

### API Integration
- Use axios with proper error handling
- Create typed response interfaces
- Implement retry logic for transient failures
- Use environment variables for endpoints and keys
- Add request/response interceptors for logging

### State Management
- Use React hooks for local state
- Custom hooks for shared logic
- Consider React Query/SWR for server state (if needed)
- Avoid prop drilling with composition

### Styling
- Tailwind CSS for utility-first styling
- shadcn/ui components for consistent UI
- CSS variables for theming (light/dark mode)
- Mobile-first breakpoints
- Accessible color contrast ratios

## Energy Simulation Logic

### Energy Flow Priority (per 30-min interval)
1. PV generation meets household load
2. Excess PV charges battery (subject to limits)
3. Remaining excess exported to grid (SEG revenue)
4. Load shortfall met by battery discharge
5. Remaining shortfall imported from grid (cost)

### Battery Model
- Capacity (kWh) - total storage
- Max charge/discharge power (kW) - rate limits
- Round-trip efficiency (%) - energy losses
- Greedy dispatch (no price optimization in v1)

### Financial Calculations
- Import cost = grid import (kWh) × import tariff (£/kWh)
- Export revenue = grid export (kWh) × export tariff (£/kWh)
- Net monthly cost vs. actual direct debit
- Running balance: cumulative (savings - costs)
- Simple payback = system cost / annual savings

## Out of Scope (v1)
- Agile/Tracker tariff optimization
- Price-aware battery dispatch
- EV charging integration
- Heat pump load modeling
- Battery degradation
- Carbon intensity comparison

## Progress Tracking
- [x] Project scaffolding (Vite + React + TypeScript)
- [x] Tailwind CSS v4 configured
- [x] shadcn/ui configured (components.json)
- [x] Core dependencies installed (axios, date-fns, recharts, lucide-react)
- [x] Path aliases configured (`@/*`)
- [ ] Domain types defined (Stage 1)
- [ ] Octopus Energy API client (Stage 2)
- [ ] Solar irradiance data fetcher (Stage 3)
- [ ] PV generation calculator (Stage 3)
- [ ] Battery dispatch engine (Stage 4)
- [ ] Cost/tariff calculator (Stage 5)
- [ ] Monthly financial analyzer (Stage 6)
- [ ] Simulation orchestrator
- [ ] Input form UI
- [ ] Results visualization components
- [ ] End-to-end testing
- [ ] Documentation & README updates

## Environment Variables Required
```env
VITE_OCTOPUS_API_KEY=sk_live_...
VITE_SOLAR_API_KEY=...
VITE_SOLAR_API_ENDPOINT=https://...
```

## Next Steps
1. Define domain types in `src/types/`
2. Install initial shadcn/ui components: `button`, `input`, `card`, `label`, `select`, `table`, `tabs`
3. Create `.env.example` template
4. Build Octopus Energy API client with authentication
5. Implement PV generation calculator
6. Build battery dispatch engine
7. Create simulation orchestrator
8. Develop UI components and visualizations