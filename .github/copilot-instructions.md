# Solar + Battery ROI Calculator - Project Guide

## Overview
React SPA for UK households to calculate solar PV + battery savings using actual Octopus Energy consumption data and NASA POWER solar estimates.

## Tech Stack
- React 19, TypeScript 5.9 (strict mode, ES2022)
- Vite 7, Tailwind CSS v4, shadcn/ui
- Recharts, Axios, Date-fns, Lucide React

## Project Structure
```
src/
├── types/          # Domain type definitions
├── services/       # API clients (Octopus, NASA POWER, postcodes.io)
├── lib/            # Calculation engines (solar, battery, cost)
├── hooks/          # React custom hooks
└── components/     # UI components
```

## Key APIs
- **Octopus Energy GraphQL**: User's consumption data (requires API key)
- **NASA POWER**: Solar irradiance (free, CORS enabled)
- **postcodes.io**: UK postcode → lat/lng (free, CORS enabled)

## Development
```bash
npm install
npm run dev     # Development server with API proxy
npm run build   # Production build
npm test        # Run tests
```

## Deployment
Azure Static Web Apps via GitHub Actions. Push to main triggers automatic deployment.
