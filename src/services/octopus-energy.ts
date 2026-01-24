import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type { ConsumptionRecord, ConsumptionTimeSeries, ConsumptionRequest, DailyConsumption, ActualTariffInfo, ActualCostData, ActualCostSummary, TariffRatePeriod } from '@/types';

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
 * GraphQL response for tariff/agreement query
 */
interface TariffQueryResponse {
    data?: {
        account?: {
            number: string;
            electricityAgreements?: Array<{
                id: number;
                validFrom: string;
                validTo?: string;
                meterPoint?: {
                    mpan: string;
                };
                tariff?: {
                    productCode?: string;
                    tariffCode?: string;
                    displayName?: string;
                    fullName?: string;
                    standingCharge?: number;
                    unitRate?: number;
                    dayRate?: number;
                    nightRate?: number;
                    preVatStandingCharge?: number;
                    preVatUnitRate?: number;
                    preVatDayRate?: number;
                    preVatNightRate?: number;
                    isExport?: boolean;
                };
            }>;
        };
    };
    errors?: Array<{
        message: string;
        extensions?: { errorCode?: string };
    }>;
}

/**
 * GraphQL response for smart meter telemetry with costs
 */
interface SmartMeterCostResponse {
    data?: {
        smartMeterTelemetry?: Array<{
            readAt: string;
            consumptionDelta?: number;
            costDelta?: number;
            costDeltaWithTax?: number;
        }>;
    };
    errors?: Array<{
        message: string;
        extensions?: { errorCode?: string };
    }>;
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
    private readonly graphqlUrl: string;

    constructor(apiKey: string, baseURL?: string) {
        this.apiKey = apiKey;

        // Check if we're in a Vite environment
        const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

        // Use proxy in development to avoid CORS issues
        const effectiveBaseURL = baseURL ?? (
            isDev
                ? '/api/octopus'
                : 'https://api.octopus.energy'
        );

        // Set GraphQL URL based on environment
        this.graphqlUrl = isDev
            ? '/api/octopus/v1/graphql/'
            : 'https://api.octopus.energy/v1/graphql/';

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

        try {
            const response = await axios.post<ObtainTokenResponse>(
                this.graphqlUrl,
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

        try {
            const response = await axios.post<AccountQueryResponse>(
                this.graphqlUrl,
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

        try {
            const response = await axios.post<SolarGenerationEstimateResponse>(
                this.graphqlUrl,
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

    /**
     * Fetch the user's actual tariff information from their account agreements
     * Returns the current active tariff for import and export (if available)
     */
    async fetchActualTariff(accountNumber: string): Promise<{ import?: ActualTariffInfo; export?: ActualTariffInfo } | null> {
        // First obtain a token
        let token: string;
        try {
            token = await this.obtainToken();
        } catch {
            return null;
        }

        // Query electricityAgreements directly on the account
        // This is a simpler query that should work reliably
        const query = `
            query GetAccountTariffs($accountNumber: String!) {
                account(accountNumber: $accountNumber) {
                    number
                    electricityAgreements {
                        id
                        validFrom
                        validTo
                        meterPoint {
                            mpan
                        }
                        tariff {
                            ... on StandardTariff {
                                productCode
                                tariffCode
                                displayName
                                fullName
                                standingCharge
                                unitRate
                                preVatStandingCharge
                                preVatUnitRate
                                isExport
                            }
                            ... on DayNightTariff {
                                productCode
                                tariffCode
                                displayName
                                fullName
                                standingCharge
                                dayRate
                                nightRate
                                preVatStandingCharge
                                preVatDayRate
                                preVatNightRate
                                isExport
                            }
                            ... on HalfHourlyTariff {
                                productCode
                                tariffCode
                                displayName
                                fullName
                                standingCharge
                                preVatStandingCharge
                                isExport
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await axios.post<TariffQueryResponse>(
                this.graphqlUrl,
                {
                    query,
                    variables: { accountNumber },
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
                console.error('[Octopus] Tariff query errors:', response.data.errors);
                return null;
            }

            const account = response.data.data?.account;
            const agreements = account?.electricityAgreements;
            if (!agreements?.length) {
                console.warn('[Octopus] No electricity agreements found');
                return null;
            }

            let importTariff: ActualTariffInfo | undefined;
            let exportTariff: ActualTariffInfo | undefined;

            // Find current active tariffs from agreements
            const now = new Date();
            for (const agreement of agreements) {
                const tariff = agreement.tariff;
                if (!tariff) continue;

                // Check if agreement is currently active
                const validFrom = new Date(agreement.validFrom);
                const validTo = agreement.validTo ? new Date(agreement.validTo) : null;
                const isActive = validFrom <= now && (!validTo || validTo >= now);
                
                if (!isActive) continue;

                // Get the unit rate - for HalfHourly tariffs, we need to fetch from REST API
                let unitRatePence = tariff.unitRate ?? tariff.dayRate ?? 0;
                
                // If no rate is available (HalfHourly tariff), try to fetch from REST API
                if (unitRatePence === 0 && tariff.productCode && tariff.tariffCode) {
                    try {
                        const rates = await this.fetchTariffRates(tariff.productCode, tariff.tariffCode);
                        if (rates) {
                            // For time-of-use tariffs, use the standard/average rate
                            unitRatePence = rates.standardRate ?? rates.averageRate ?? 0;
                        }
                    } catch {
                        // Silently fail - we'll show 0 rate
                    }
                }

                const tariffInfo: ActualTariffInfo = {
                    productCode: tariff.productCode ?? 'Unknown',
                    tariffCode: tariff.tariffCode ?? 'Unknown',
                    displayName: tariff.displayName ?? 'Standard Tariff',
                    fullName: tariff.fullName,
                    unitRatePence,
                    standingChargePence: tariff.standingCharge ?? 0,
                    isVariable: tariff.tariffCode?.toLowerCase().includes('agile') ||
                               tariff.tariffCode?.toLowerCase().includes('tracker') ||
                               tariff.tariffCode?.toLowerCase().includes('cosy'),
                    validFrom: agreement.validFrom,
                    validTo: agreement.validTo,
                };

                if (tariff.isExport) {
                    exportTariff = tariffInfo;
                } else {
                    importTariff = tariffInfo;
                }
            }

            return {
                import: importTariff,
                export: exportTariff,
            };
        } catch (error) {
            console.error('[Octopus] Failed to fetch tariff:', error);
            return null;
        }
    }

    /**
     * Fetch tariff rates from the REST API
     * Used for HalfHourly tariffs where rates aren't in GraphQL response
     */
    private async fetchTariffRates(productCode: string, tariffCode: string): Promise<{
        standardRate?: number;
        averageRate?: number;
        peakRate?: number;
        offPeakRate?: number;
    } | null> {
        try {
            // Fetch from product API (no auth required)
            const productUrl = `https://api.octopus.energy/v1/products/${productCode}/`;
            const response = await axios.get<{
                single_register_electricity_tariffs?: Record<string, {
                    direct_debit_monthly?: {
                        code: string;
                        standard_unit_rate_inc_vat?: number;
                    };
                }>;
            }>(productUrl, { timeout: 10000 });

            // Extract the region code from tariff code (e.g., "E-1R-COSY-FIX-12M-25-09-24-K" -> "_K")
            const regionMatch = tariffCode.match(/-([A-P])$/);
            if (!regionMatch) return null;

            const regionKey = `_${regionMatch[1]}`;
            const regionTariff = response.data.single_register_electricity_tariffs?.[regionKey];
            const standardRate = regionTariff?.direct_debit_monthly?.standard_unit_rate_inc_vat;

            if (standardRate !== undefined) {
                return { standardRate, averageRate: standardRate };
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Fetch half-hourly unit rates for a tariff over a date range
     * This provides actual time-of-use rates for accurate cost calculation
     */
    async fetchHalfHourlyRates(
        productCode: string,
        tariffCode: string,
        periodFrom: Date,
        periodTo: Date
    ): Promise<TariffRatePeriod[]> {
        const rates: TariffRatePeriod[] = [];
        
        try {
            // Format dates for API (extend range slightly to ensure coverage)
            const from = new Date(periodFrom);
            from.setDate(from.getDate() - 1);
            const to = new Date(periodTo);
            to.setDate(to.getDate() + 1);

            const url = `https://api.octopus.energy/v1/products/${productCode}/electricity-tariffs/${tariffCode}/standard-unit-rates/`;
            
            let nextUrl: string | null = `${url}?period_from=${from.toISOString()}&period_to=${to.toISOString()}&page_size=1500`;

            while (nextUrl) {
                const response = await axios.get<{
                    count: number;
                    next: string | null;
                    results: Array<{
                        value_inc_vat: number;
                        valid_from: string;
                        valid_to: string;
                    }>;
                }>(nextUrl, { timeout: 15000 });

                for (const rate of response.data.results) {
                    rates.push({
                        ratePence: rate.value_inc_vat,
                        validFrom: rate.valid_from,
                        validTo: rate.valid_to,
                    });
                }

                nextUrl = response.data.next;
            }

            // Sort by valid_from date descending (most recent first)
            rates.sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());

            console.log(`[Octopus] Fetched ${rates.length} half-hourly rates for ${tariffCode}`);
            return rates;
        } catch (error) {
            console.error('[Octopus] Failed to fetch half-hourly rates:', error);
            return [];
        }
    }

    /**
     * Get the rate for a specific timestamp from half-hourly rates
     */
    static getRateForTimestamp(rates: TariffRatePeriod[], timestamp: Date): number | null {
        const time = timestamp.getTime();
        
        for (const rate of rates) {
            const from = new Date(rate.validFrom).getTime();
            const to = new Date(rate.validTo).getTime();
            
            if (time >= from && time < to) {
                return rate.ratePence;
            }
        }
        
        return null;
    }

    /**
     * Analyze half-hourly rates to extract peak/off-peak/standard rates
     */
    static analyzeRates(rates: TariffRatePeriod[]): { 
        offPeak: number; 
        standard: number; 
        peak: number;
        weighted: number;
    } {
        if (rates.length === 0) {
            return { offPeak: 0, standard: 0, peak: 0, weighted: 0 };
        }

        const uniqueRates = [...new Set(rates.map(r => Math.round(r.ratePence * 100) / 100))].sort((a, b) => a - b);
        
        // Calculate weighted average
        let totalHours = 0;
        let weightedSum = 0;
        for (const rate of rates) {
            const from = new Date(rate.validFrom);
            const to = new Date(rate.validTo);
            const hours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
            totalHours += hours;
            weightedSum += rate.ratePence * hours;
        }
        const weighted = totalHours > 0 ? weightedSum / totalHours : 0;

        if (uniqueRates.length === 1) {
            // Flat rate tariff
            return { 
                offPeak: uniqueRates[0] ?? 0, 
                standard: uniqueRates[0] ?? 0, 
                peak: uniqueRates[0] ?? 0,
                weighted: uniqueRates[0] ?? 0
            };
        } else if (uniqueRates.length === 2) {
            // Two-rate tariff (day/night)
            return { 
                offPeak: uniqueRates[0] ?? 0, 
                standard: uniqueRates[1] ?? 0, 
                peak: uniqueRates[1] ?? 0,
                weighted
            };
        } else {
            // Three or more rates (TOU like Cosy, Flux)
            return { 
                offPeak: uniqueRates[0] ?? 0, 
                standard: uniqueRates[Math.floor(uniqueRates.length / 2)] ?? 0, 
                peak: uniqueRates[uniqueRates.length - 1] ?? 0,
                weighted
            };
        }
    }

    /**
     * Fetch raw tariff data for debugging purposes
     * Uses __typename to see what tariff type is returned
     */
    async fetchActualTariffRaw(accountNumber: string): Promise<unknown> {
        let token: string;
        try {
            token = await this.obtainToken();
        } catch {
            return null;
        }

        // Use __typename to discover the actual tariff type
        const query = `
            query GetAccountTariffsRaw($accountNumber: String!) {
                account(accountNumber: $accountNumber) {
                    number
                    electricityAgreements {
                        id
                        validFrom
                        validTo
                        tariff {
                            __typename
                            ... on StandardTariff {
                                productCode tariffCode displayName fullName
                                standingCharge unitRate isExport
                            }
                            ... on DayNightTariff {
                                productCode tariffCode displayName fullName
                                standingCharge dayRate nightRate isExport
                            }
                            ... on ThreeRateTariff {
                                productCode tariffCode displayName fullName
                                standingCharge dayRate nightRate offPeakRate isExport
                            }
                            ... on HalfHourlyTariff {
                                productCode tariffCode displayName fullName
                                standingCharge isExport
                            }
                            ... on PrepayTariff {
                                productCode tariffCode displayName fullName
                                standingCharge unitRate isExport
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await axios.post(
                this.graphqlUrl,
                {
                    query,
                    variables: { accountNumber },
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token,
                    },
                    timeout: 30000,
                }
            );

            return response.data?.data?.account?.electricityAgreements ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Fetch actual costs from smart meter telemetry
     * This returns the actual costs calculated by Octopus based on the user's tariff
     */
    async fetchActualCosts(
        deviceId: string,
        startDate: string,
        endDate: string
    ): Promise<ActualCostSummary | null> {
        // First obtain a token
        let token: string;
        try {
            token = await this.obtainToken();
        } catch {
            return null;
        }

        const query = `
            query GetSmartMeterCosts($deviceId: String!, $start: DateTime!, $end: DateTime!) {
                smartMeterTelemetry(
                    deviceId: $deviceId,
                    start: $start,
                    end: $end,
                    grouping: DAY
                ) {
                    readAt
                    consumptionDelta
                    costDelta
                    costDeltaWithTax
                }
            }
        `;

        try {
            const response = await axios.post<SmartMeterCostResponse>(
                this.graphqlUrl,
                {
                    query,
                    variables: {
                        deviceId,
                        start: startDate,
                        end: endDate,
                    },
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
                return null;
            }

            const telemetry = response.data.data?.smartMeterTelemetry ?? [];
            if (telemetry.length === 0) {
                return null;
            }

            const dailyCosts: ActualCostData[] = telemetry.map(t => ({
                date: t.readAt.split('T')[0],
                consumptionKwh: t.consumptionDelta ?? 0,
                costPence: t.costDelta ?? 0,
                costWithVatPence: t.costDeltaWithTax ?? 0,
            }));

            const totalConsumptionKwh = dailyCosts.reduce((sum, d) => sum + d.consumptionKwh, 0);
            const totalCostPence = dailyCosts.reduce((sum, d) => sum + d.costWithVatPence, 0);

            return {
                totalConsumptionKwh,
                totalCostPounds: totalCostPence / 100,
                dailyCosts,
                periodStart: startDate,
                periodEnd: endDate,
            };
        } catch {
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
