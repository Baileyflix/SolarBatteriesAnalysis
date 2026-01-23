import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { IrradianceRecord, DailyIrradiance } from '@/types';

/**
 * Response from NASA POWER API for solar irradiance data
 * Documentation: https://power.larc.nasa.gov/docs/services/api/
 */
interface NASAPowerResponse {
    properties: {
        parameter: {
            ALLSKY_SFC_SW_DWN: Record<string, number>; // Global Horizontal Irradiance (kWh/m²/day)
        };
    };
    geometry: {
        type: string;
        coordinates: [number, number, number];
    };
    header: {
        fill_value: number;
    };
}

/**
 * Error thrown when solar data API requests fail
 */
export class SolarDataError extends Error {
    readonly statusCode?: number;
    readonly originalError?: unknown;

    constructor(
        message: string,
        statusCode?: number,
        originalError?: unknown
    ) {
        super(message);
        this.name = 'SolarDataError';
        this.statusCode = statusCode;
        this.originalError = originalError;
    }
}

/**
 * Location coordinates for solar data requests
 */
export interface LocationCoordinates {
    latitude: number;
    longitude: number;
}

/**
 * Client for fetching historical solar irradiance data
 * Uses NASA POWER API (free, no API key required for basic usage)
 * In development, proxied through Vite dev server
 * In production, calls NASA POWER API directly (CORS enabled)
 */
export class SolarDataClient {
    private readonly client: AxiosInstance;

    constructor() {
        // NASA POWER API has CORS enabled, call directly in production
        const baseURL = import.meta.env.DEV
            ? '/api/nasa-power/api/temporal/daily/point'
            : 'https://power.larc.nasa.gov/api/temporal/daily/point';
        
        this.client = axios.create({
            baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Fetch daily solar irradiance data for a location and date range
     * Returns daily GHI values which will be distributed across half-hourly periods
     */
    async fetchIrradiance(
        location: LocationCoordinates,
        startDate: string,
        endDate: string
    ): Promise<IrradianceRecord[]> {
        try {
            const params = {
                parameters: 'ALLSKY_SFC_SW_DWN',
                community: 'RE',
                longitude: location.longitude.toFixed(4),
                latitude: location.latitude.toFixed(4),
                start: this.formatDate(startDate),
                end: this.formatDate(endDate),
                format: 'JSON',
            };

            type ResponseType = { data: NASAPowerResponse };
            const response: ResponseType = await this.client.get('', { params });

            const irradianceData = response.data.properties.parameter.ALLSKY_SFC_SW_DWN;
            const fillValue = response.data.header.fill_value; // -999 indicates missing data

            // Convert daily data to half-hourly intervals, filtering out missing values
            const records = this.convertDailyToHalfHourly(irradianceData, startDate, endDate, fillValue);
            return records;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new SolarDataError(
                    `Failed to fetch solar irradiance data: ${error.message}`,
                    error.response?.status,
                    error
                );
            }
            throw new SolarDataError('Unexpected error fetching solar data', undefined, error);
        }
    }

    /**
     * Fetch daily solar irradiance data (simplified - no half-hourly conversion)
     * Returns daily GHI in kWh/m²/day directly from NASA POWER
     */
    async fetchDailyIrradiance(
        location: LocationCoordinates,
        startDate: string,
        endDate: string
    ): Promise<DailyIrradiance[]> {
        try {
            const params = {
                parameters: 'ALLSKY_SFC_SW_DWN',
                community: 'RE',
                longitude: location.longitude.toFixed(4),
                latitude: location.latitude.toFixed(4),
                start: this.formatDate(startDate),
                end: this.formatDate(endDate),
                format: 'JSON',
            };

            type ResponseType = { data: NASAPowerResponse };
            const response: ResponseType = await this.client.get('', { params });

            const irradianceData = response.data.properties.parameter.ALLSKY_SFC_SW_DWN;
            const fillValue = response.data.header.fill_value; // -999 indicates missing data

            const records: DailyIrradiance[] = [];

            for (const [dateKey, ghi] of Object.entries(irradianceData)) {
                // Skip missing/invalid data
                if (ghi === fillValue || ghi < 0) continue;

                // Convert YYYYMMDD to YYYY-MM-DD
                const date = `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
                records.push({
                    date,
                    ghiKwhPerM2: ghi,
                });
            }

            // Sort by date
            records.sort((a, b) => a.date.localeCompare(b.date));

            return records;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new SolarDataError(
                    `Failed to fetch solar irradiance data: ${error.message}`,
                    error.response?.status,
                    error
                );
            }
            throw new SolarDataError('Unexpected error fetching solar data', undefined, error);
        }
    }

    /**
     * Convert date string to YYYYMMDD format required by NASA POWER API
     */
    private formatDate(dateString: string): string {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Convert daily GHI values to half-hourly irradiance records
     * Uses a simplified solar curve model for intra-day distribution
     */
    private convertDailyToHalfHourly(
        dailyData: Record<string, number>,
        startDate: string,
        endDate: string,
        fillValue = -999
    ): IrradianceRecord[] {
        const records: IrradianceRecord[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        let currentDate = new Date(start);

        while (currentDate <= end) {
            const dateKey = this.formatDateKey(currentDate);
            const dailyGHI = dailyData[dateKey];

            // Skip missing data (fill_value is typically -999)
            if (dailyGHI !== undefined && dailyGHI !== fillValue && dailyGHI >= 0) {
                // Generate 48 half-hourly records for this day
                const halfHourlyRecords = this.distributeDailyGHI(currentDate, dailyGHI);
                records.push(...halfHourlyRecords);
            }

            // Move to next day
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        }

        return records;
    }

    /**
     * Format date as YYYYMMDD for lookup in NASA POWER data
     */
    private formatDateKey(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Distribute daily GHI across 48 half-hourly periods using a simplified solar curve
     * Assumes a sinusoidal distribution centered at solar noon
     */
    private distributeDailyGHI(date: Date, dailyGHIkWhPerM2: number): IrradianceRecord[] {
        const records: IrradianceRecord[] = [];
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();

        // Daylight hours vary by season - simplified model
        const dayOfYear = this.getDayOfYear(date);
        const daylightHours = this.estimateDaylightHours(dayOfYear);
        const sunriseHour = 12 - daylightHours / 2;
        const sunsetHour = 12 + daylightHours / 2;

        // Convert daily kWh/m² to total Wh/m²
        const totalWhPerM2 = dailyGHIkWhPerM2 * 1000;

        // Generate 48 half-hourly periods
        for (let period = 0; period < 48; period++) {
            const hour = Math.floor(period / 2);
            const minute = (period % 2) * 30;

            const intervalStart = new Date(year, month, day, hour, minute, 0);
            const intervalEnd = new Date(year, month, day, hour, minute + 30, 0);

            // Hour in decimal format (e.g., 14.5 for 14:30)
            const decimalHour = hour + minute / 60;

            let ghi = 0;

            // Only generate irradiance during daylight hours
            if (decimalHour >= sunriseHour && decimalHour <= sunsetHour) {
                // Sinusoidal distribution: GHI peaks at solar noon (12:00)
                const hourAngle = ((decimalHour - 12) / (daylightHours / 2)) * Math.PI;
                const solarIntensityFactor = Math.max(0, Math.cos(hourAngle));

                // Distribute energy proportionally
                // Total should integrate to totalWhPerM2 over the day
                const peakGHI = (totalWhPerM2 * Math.PI) / (daylightHours * 2);
                ghi = peakGHI * solarIntensityFactor;
            }

            records.push({
                intervalStart: intervalStart.toISOString(),
                intervalEnd: intervalEnd.toISOString(),
                ghi: Math.round(ghi * 10) / 10, // Round to 1 decimal place
            });
        }

        return records;
    }

    /**
     * Get day of year (1-365/366)
     */
    private getDayOfYear(date: Date): number {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date.getTime() - start.getTime();
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }

    /**
     * Estimate daylight hours for UK latitude (~51°N)
     * Simplified formula based on day of year
     */
    private estimateDaylightHours(dayOfYear: number): number {
        // UK has ~8 hours in winter, ~16 hours in summer
        // Summer solstice ~= day 172, Winter solstice ~= day 355
        const amplitude = 4; // Hours variation from average
        const average = 12;
        const phase = (2 * Math.PI * (dayOfYear - 172)) / 365;
        return average + amplitude * Math.cos(phase);
    }
}

/**
 * Factory function to create a solar data client
 */
export function createSolarDataClient(): SolarDataClient {
    // Use NASA POWER API (no API key required)
    return new SolarDataClient();
}

/**
 * Response from postcodes.io API
 */
interface PostcodesIOResponse {
    status: number;
    result: {
        postcode: string;
        latitude: number;
        longitude: number;
        region: string;
    } | null;
}

/**
 * Convert UK postcode to coordinates using postcodes.io (free API)
 * In development, proxied through Vite dev server
 * In production, calls postcodes.io directly (CORS enabled)
 */
export async function postcodeToCoordinates(postcode: string): Promise<LocationCoordinates> {
    const cleanPostcode = postcode.trim().replace(/\s+/g, '');
    
    // postcodes.io has CORS enabled, call directly in production
    const baseUrl = import.meta.env.DEV
        ? '/api/postcodes'
        : 'https://api.postcodes.io';

    try {
        const response = await axios.get<PostcodesIOResponse>(
            `${baseUrl}/postcodes/${encodeURIComponent(cleanPostcode)}`
        );

        if (response.data.status === 200 && response.data.result) {
            return {
                latitude: response.data.result.latitude,
                longitude: response.data.result.longitude,
            };
        }
    } catch {
        // Fall through to default
        // Could not geocode postcode, using UK default location
    }

    // Default to central UK if geocoding fails
    return { latitude: 52.5, longitude: -1.5 };
}
