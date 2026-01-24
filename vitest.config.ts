import path from "path"
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
        exclude: [
            'node_modules',
            'tests/**/*',
            // Exclude old console.log-style tests (not vitest format)
            'src/lib/daily-simulator.test.ts',
            'src/lib/solar-generator.test.ts',
            'src/services/octopus-energy.test.ts',
            'src/services/solar-data.test.ts',
        ],
    },
})
