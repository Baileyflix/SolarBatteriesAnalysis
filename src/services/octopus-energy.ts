import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type { ConsumptionRecord, ConsumptionTimeSeries, ConsumptionRequest, DailyConsumption } from '@/types';

/**
 * Response structure from Octopus Energy consumption API
 */
interface OctopusConsumptionResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Array<{
        consumption: number;
        interval_start: string;
        interval_end: string;
    }>;
}

/**
 * GraphQL response for obtaining Kraken token
 */
interface ObtainTokenResponse {
    data?: {
        obtainKrakenToken?: {
            token: string;
            refreshToken: string;
            refreshExpiresIn: number;
        };
    };
    errors?: Array<{
        message: string;
        extensions?: { errorCode?: string };
    }>;
}

/**
 * GraphQL response for account query
 */
interface AccountQueryResponse {
    data?: {
        viewer?: {
            accounts?: Array<{
                number: string;
                status: string;
                properties?: Array<{
                    address: string;
                    postcode: string;
                    electricityMeterPoints?: Array<{
                        mpan: string;
                        meters?: Array<{
                            serialNumber: string;
                            makeAndType?: string;
                            meterType?: string;
                        }>;
                    }>;
                }>;
            }>;
        };
    };
    errors?: Array<{
        message: string;
        extensions?: { errorCode?: string };
    }>;
}

/**
 * GraphQL response for solar generation estimate query
 * Note: Returns hourly estimates with date, hour (0-23), and value (kWh)
 */
interface SolarGenerationEstimateResponse {
    data?: {
        getSolarGenerationEstimate?: {
            solarGenerationEstimates: Array<{
                date: string;
                hour: number;
                value: number;
            }>;
        };
    };
    errors?: Array<{
        message: string;
        extensions?: { errorCode?: string };
    }>;
}

/**
 * Solar generation estimate from Octopus
 */
export interface OctopusSolarEstimate {
    date: string;
    kwhEstimate: number;
}

/**
 * Annual solar estimate summary
 */
export interface OctopusSolarEstimateSummary {
    weeklyEstimates: OctopusSolarEstimate[];
    weeklyTotalKwh: number;
    annualEstimateKwh: number;
    dailyAverageKwh: number;
}

/**
 * Discovered meter information from account
 */
export interface DiscoveredMeter {
    mpan: string;
    serialNumber: string;
    address: string;
    postcode: string;
    accountNumber: string;
    makeAndType?: string;
    meterType?: string;
}

/**
 * Account discovery result
 */
export interface AccountDiscoveryResult {
    accounts: Array<{
        number: string;
        status: string;
    }>;
    meters: DiscoveredMeter[];
}

/**
 * Error thrown when Octopus Energy API requests fail
 */
export class OctopusEnergyError extends Error {
    readonly statusCode?: number;
    readonly originalError?: unknown;

    constructor(
        message: string,
        statusCode?: number,
        originalError?: unknown
    ) {
        super(message);
        this.name = 'OctopusEnergyError';
        this.statusCode = statusCode;
        this.originalError = originalError;
    }
}

/**
 * Client for interacting with Octopus Energy API
 * Handles authentication, pagination, and data normalization
 */
export class OctopusEnergyClient {
    private readonly client: AxiosInstance;
    private readonly apiKey: string;

    constructor(apiKey: string, baseURL?: string) {
        this.apiKey = apiKey;

        // Use proxy in development to avoid CORS issues
        const effectiveBaseURL = baseURL ?? (
            import.meta.env.DEV
                ? '/api/octopus'
                : 'https://api.octopus.energy'
        );

        this.client = axios.create({
            baseURL: effectiveBaseURL,
            auth: {
                username: apiKey,
                password: '', // Octopus uses API key as username, empty password
            },
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
        });

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError) => {
                throw this.handleError(error);
            }
        );
    }

    /**
     * Fetch consumption data for a specific meter and date range
     * Handles pagination automatically to retrieve all records
     */
    async fetchConsumption(request: ConsumptionRequest): Promise<ConsumptionTimeSeries> {
        const allRecords: ConsumptionRecord[] = [];
        let nextUrl: string | null = this.buildConsumptionUrl(request);

        try {
            // Pagination loop - fetch all pages
            while (nextUrl) {
                type ResponseType = { data: OctopusConsumptionResponse };
                const response: ResponseType = await this.client.get<OctopusConsumptionResponse>(nextUrl, {
                    baseURL: nextUrl.startsWith('http') ? undefined : this.client.defaults.baseURL,
                });

                const results = response.data.results;
                const next: string | null = response.data.next;

                // Transform Octopus API format to our domain model
                const records = results.map((result): ConsumptionRecord => ({
                    intervalStart: result.interval_start,
                    intervalEnd: result.interval_end,
                    consumption: result.consumption,
                }));

                allRecords.push(...records);
                nextUrl = next;
            }

            // Sort records by interval start (ascending - oldest first)
            allRecords.sort((a, b) =>
                new Date(a.intervalStart).getTime() - new Date(b.intervalStart).getTime()
            );

            return {
                mpan: request.mpan,
                serialNumber: request.serialNumber,
                periodStart: request.periodFrom,
                periodEnd: request.periodTo,
                records: allRecords,
            };
        } catch (error) {
            if (error instanceof OctopusEnergyError) {
                throw error;
            }
            throw new OctopusEnergyError(
                'Failed to fetch consumption data from Octopus Energy',
                undefined,
                error
            );
        }
    }

    /**
     * Fetch daily consumption data (aggregated by day)
     * More efficient than half-hourly for annual analysis
     */
    async fetchDailyConsumption(request: ConsumptionRequest): Promise<DailyConsumption[]> {
        const allRecords: DailyConsumption[] = [];
        let nextUrl: string | null = this.buildConsumptionUrl(request, 'day');

        try {
            while (nextUrl) {
                type ResponseType = { data: OctopusConsumptionResponse };
                const response: ResponseType = await this.client.get<OctopusConsumptionResponse>(nextUrl, {
                    baseURL: nextUrl.startsWith('http') ? undefined : this.client.defaults.baseURL,
                });

                const results = response.data.results;
                const next: string | null = response.data.next;

                // Transform to daily records (interval_start is the day)
                const records = results.map((result): DailyConsumption => ({
                    date: result.interval_start.split('T')[0], // Extract YYYY-MM-DD
                    consumptionKwh: result.consumption,
                }));

                allRecords.push(...records);
                nextUrl = next;
            }

            // Sort by date (ascending)
            allRecords.sort((a, b) => a.date.localeCompare(b.date));

            return allRecords;
        } catch (error) {
            if (error instanceof OctopusEnergyError) {
                throw error;
            }
            throw new OctopusEnergyError(
                'Failed to fetch daily consumption data from Octopus Energy',
                undefined,
                error
            );
        }
    }

    /**
     * Build the consumption endpoint URL with query parameters
     */
    private buildConsumptionUrl(request: ConsumptionRequest, groupBy?: 'day' | 'week' | 'month' | 'quarter'): string {
        const { mpan, serialNumber, periodFrom, periodTo } = request;
        const params = new URLSearchParams({
            period_from: periodFrom,
            period_to: periodTo,
            page_size: '25000', // Maximum allowed by Octopus API
            order_by: 'period', // Ensure chronological order
        });

        if (groupBy) {
            params.set('group_by', groupBy);
        }

        return `/v1/electricity-meter-points/${mpan}/meters/${serialNumber}/consumption/?${params.toString()}`;
    }

    /**
     * Convert axios errors into domain-specific errors with better messages
     */
    private handleError(error: AxiosError): OctopusEnergyError {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data as { detail?: string } | undefined;

            switch (status) {
                case 401:
                    return new OctopusEnergyError(
                        'Invalid API key. Please check your Octopus Energy API credentials.',
                        status,
                        error
                    );
                case 403:
                    return new OctopusEnergyError(
                        'Access forbidden. You may not have permission to access this meter.',
                        status,
                        error
                    );
                case 404:
                    return new OctopusEnergyError(
                        'Meter not found. Please verify your MPAN and serial number.',
                        status,
                        error
                    );
                case 429:
                    return new OctopusEnergyError(
                        'Rate limit exceeded. Please try again later.',
                        status,
                        error
                    );
                default:
                    return new OctopusEnergyError(
                        data?.detail || `API request failed with status ${status}`,
                        status,
                        error
                    );
            }
        }

        if (error.request) {
            return new OctopusEnergyError(
                'No response from Octopus Energy API. Please check your internet connection.',
                undefined,
                error
            );
        }

        return new OctopusEnergyError(
            'Failed to make request to Octopus Energy API',
            undefined,
            error
        );
    }

    /**
     * Validate that the API key and meter details are correct
     * by attempting to fetch a small amount of data
     */
    async validateCredentials(mpan: string, serialNumber: string): Promise<boolean> {
        try {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            await this.fetchConsumption({
                mpan,
                serialNumber,
                periodFrom: yesterday.toISOString(),
                periodTo: now.toISOString(),
                apiKey: this.apiKey,
            });

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Obtain a Kraken token using the API key
     * Required for GraphQL queries to fetch account details
     */
    async obtainToken(): Promise<string> {
        const query = `
            mutation ObtainKrakenToken($input: ObtainJSONWebTokenInput!) {
                obtainKrakenToken(input: $input) {
                    token
                    refreshToken
                    refreshExpiresIn
                }
            }
        `;

        // Use proxy in development to avoid CORS issues
        const graphqlUrl = import.meta.env.DEV
            ? '/api/octopus/v1/graphql/'
            : 'https://api.octopus.energy/v1/graphql/';

        try {
            const response = await axios.post<ObtainTokenResponse>(
                graphqlUrl,
                {
                    query,
                    variables: { input: { APIKey: this.apiKey } },
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000,
                }
            );

            if (response.data.errors?.length) {
                const error = response.data.errors[0];
                throw new OctopusEnergyError(
                    error.message || 'Failed to obtain authentication token',
                    undefined,
                    error
                );
            }

            const token = response.data.data?.obtainKrakenToken?.token;
            if (!token) {
                throw new OctopusEnergyError('No token returned from authentication');
            }

            return token;
        } catch (error) {
            if (error instanceof OctopusEnergyError) {
                throw error;
            }
            throw new OctopusEnergyError(
                'Failed to authenticate with Octopus Energy API',
                undefined,
                error
            );
        }
    }

    /**
     * Discover account details including all meters
     * Uses GraphQL API to fetch account information
     */
    async discoverAccounts(): Promise<AccountDiscoveryResult> {
        // First obtain a token
        const token = await this.obtainToken();

        const query = `
            query GetAccountDetails {
                viewer {
                    accounts {
                        number
                        ... on AccountType {
                            status
                            properties {
                                address
                                postcode
                                electricityMeterPoints {
                                    mpan
                                    meters {
                                        serialNumber
                                        makeAndType
                                        meterType
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        // Use proxy in development to avoid CORS issues
        const graphqlUrl = import.meta.env.DEV
            ? '/api/octopus/v1/graphql/'
            : 'https://api.octopus.energy/v1/graphql/';

        try {
            const response = await axios.post<AccountQueryResponse>(
                graphqlUrl,
                { query },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token,
                    },
                    timeout: 30000,
                }
            );

            if (response.data.errors?.length) {
                const error = response.data.errors[0];
                throw new OctopusEnergyError(
                    error.message || 'Failed to fetch account details',
                    undefined,
                    error
                );
            }

            const accounts = response.data.data?.viewer?.accounts ?? [];
            const meters: DiscoveredMeter[] = [];

            for (const account of accounts) {
                for (const property of account.properties ?? []) {
                    for (const meterPoint of property.electricityMeterPoints ?? []) {
                        for (const meter of meterPoint.meters ?? []) {
                            meters.push({
                                mpan: meterPoint.mpan,
                                serialNumber: meter.serialNumber,
                                address: property.address,
                                postcode: property.postcode,
                                accountNumber: account.number,
                                makeAndType: meter.makeAndType,
                                meterType: meter.meterType,
                            });
                        }
                    }
                }
            }

            return {
                accounts: accounts.map(a => ({
                    number: a.number,
                    status: a.status,
                })),
                meters,
            };
        } catch (error) {
            if (error instanceof OctopusEnergyError) {
                throw error;
            }
            throw new OctopusEnergyError(
                'Failed to fetch account details from Octopus Energy',
                undefined,
                error
            );
        }
    }

    /**
     * Fetch Octopus's solar generation estimate for a postcode
     * Returns estimated kWh for an "average domestic solar installation"
     * This is based on Octopus's own data and UK-specific conditions
     */
    async fetchSolarEstimate(postcode: string): Promise<OctopusSolarEstimateSummary | null> {
        // First obtain a token - this query requires authentication
        let token: string;
        try {
            token = await this.obtainToken();
        } catch {
            return null;
        }

        // Use a date in the recent past (API may not support future dates)
        // Use 7 days ago to ensure data is available
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fromDate = weekAgo.toISOString().split('T')[0];

        const query = `
            query GetSolarGenerationEstimate($postcode: String!, $fromDate: Date!) {
                getSolarGenerationEstimate(postcode: $postcode, fromDate: $fromDate) {
                    solarGenerationEstimates {
                        date
                        hour
                        value
                    }
                }
            }
        `;

        // Use proxy in development to avoid CORS issues
        const graphqlUrl = import.meta.env.DEV
            ? '/api/octopus/v1/graphql/'
            : 'https://api.octopus.energy/v1/graphql/';

        try {
            const response = await axios.post<SolarGenerationEstimateResponse>(
                graphqlUrl,
                {
                    query,
                    variables: { postcode, fromDate },
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token,
                    },
                    timeout: 30000,
                }
            );

            if (response.data.errors?.length) {
                // Don't throw - just return null, this is optional data
                return null;
            }

            const estimates = response.data.data?.getSolarGenerationEstimate?.solarGenerationEstimates ?? [];

            if (estimates.length === 0) {
                return null;
            }

            // Aggregate hourly data into daily totals
            const dailyTotals = new Map<string, number>();
            for (const e of estimates) {
                const current = dailyTotals.get(e.date) ?? 0;
                dailyTotals.set(e.date, current + e.value);
            }

            // Transform to our format
            const weeklyEstimates: OctopusSolarEstimate[] = Array.from(dailyTotals.entries()).map(([date, kwhEstimate]) => ({
                date,
                kwhEstimate,
            }));

            // Calculate totals
            const weeklyTotalKwh = weeklyEstimates.reduce((sum, e) => sum + e.kwhEstimate, 0);
            const daysOfData = weeklyEstimates.length || 7;
            const dailyAverageKwh = weeklyTotalKwh / daysOfData;

            // Extrapolate to annual (simple multiplication)
            const annualEstimateKwh = dailyAverageKwh * 365;

            return {
                weeklyEstimates,
                weeklyTotalKwh,
                annualEstimateKwh,
                dailyAverageKwh,
            };
        } catch {
            // Don't throw - just return null, this is optional data
            return null;
        }
    }
}

/**
 * Factory function to create an Octopus Energy client from environment variables
 */
export function createOctopusClient(): OctopusEnergyClient {
    const apiKey = import.meta.env.VITE_OCTOPUS_API_KEY;
    const baseURL = import.meta.env.VITE_OCTOPUS_API_BASE_URL;

    if (!apiKey) {
        throw new OctopusEnergyError(
            'VITE_OCTOPUS_API_KEY environment variable is not set'
        );
    }

    return new OctopusEnergyClient(apiKey, baseURL);
}
