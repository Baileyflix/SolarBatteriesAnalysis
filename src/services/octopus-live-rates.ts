import { OctopusEnergyClient } from './octopus-energy';
import type { UK_TARIFF_PRESETS } from '@/lib/cost-engine';
import type { TariffConfig } from '@/types';

/**
 * Live tariff rates sourced directly from Octopus Energy's public product API
 * (https://api.octopus.energy/v1/ - no API key required), so the static
 * UK_TARIFF_PRESETS in cost-engine.ts can be kept up to date and regionalized
 * instead of relying on a hand-maintained snapshot.
 */

type PresetKey = keyof typeof UK_TARIFF_PRESETS;

interface OctopusProductSummary {
    code: string;
    display_name: string;
    direction: 'IMPORT' | 'EXPORT';
    is_prepay: boolean;
    is_business: boolean;
    available_from: string;
    available_to: string | null;
}

interface ProductListResponse {
    results: OctopusProductSummary[];
}

interface OctopusPaymentMethodTariff {
    code: string;
    standing_charge_inc_vat?: number;
}

interface ProductDetailResponse {
    // Fixed-term products key their rates under "direct_debit_monthly"; fully
    // variable products with no fixed term (e.g. Flexible Octopus) use "varying"
    // instead - both need to be checked.
    single_register_electricity_tariffs?: Record<string, {
        direct_debit_monthly?: OctopusPaymentMethodTariff;
        varying?: OctopusPaymentMethodTariff;
    }>;
}

interface UnitRatesResponse {
    results: Array<{ value_inc_vat: number; valid_from: string; valid_to: string }>;
}

interface LiveDirectionRates {
    standingChargePence?: number;
    standardRatePence: number;
    /** Only set for genuinely time-of-use tariffs */
    offPeakRatePence?: number;
    /** Only set for genuinely time-of-use tariffs */
    peakRatePence?: number;
}

export interface LivePresetRates {
    import: Partial<TariffConfig['import']>;
    export: Partial<TariffConfig['export']>;
}

/** Which UK_TARIFF_PRESETS keys map onto a real, currently-listed Octopus product */
interface PresetProductSource {
    importNameContains: string;
    importNameExcludes?: string;
    exportNameContains?: string;
    /**
     * Whether this tariff genuinely varies rate by time of day (Flux, Go, Cosy,
     * Agile). Flat tariffs (Flexible, Tracker) only change rate every few months,
     * so banding a +/-24h window into off-peak/standard/peak would misread a
     * quarterly price change straddling the window as a fake time-of-use split -
     * those instead just take whatever rate covers right now.
     */
    timeOfUse: boolean;
}

const PRESET_PRODUCT_SOURCES: Partial<Record<PresetKey, PresetProductSource>> = {
    octopusFlux: { importNameContains: 'flux', importNameExcludes: 'intelligent', exportNameContains: 'flux', timeOfUse: true },
    intelligentGo: { importNameContains: 'intelligent octopus go', timeOfUse: true },
    octopusGo: { importNameContains: 'octopus go', importNameExcludes: 'intelligent', timeOfUse: true },
    octopusCosy: { importNameContains: 'cosy', timeOfUse: true },
    octopusAgile: { importNameContains: 'agile octopus', timeOfUse: true },
    octopusFlexible: { importNameContains: 'flexible octopus', importNameExcludes: 'pay as you go', timeOfUse: false },
};

/** Preset keys with a live source - what callers should attempt to fetch */
export const LIVE_TARIFF_PRESET_KEYS = Object.keys(PRESET_PRODUCT_SOURCES) as PresetKey[];

const PRODUCT_LIST_TTL_MS = 24 * 60 * 60 * 1000; // product catalogue barely changes
const RATE_CACHE_TTL_MS = 3 * 60 * 60 * 1000; // covers Agile's daily rate refresh with margin
const GSP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // a postcode's grid region never changes

let productListCache: { fetchedAt: number; products: OctopusProductSummary[] } | null = null;
let productListInFlight: Promise<OctopusProductSummary[]> | null = null;
const rateCache = new Map<string, { fetchedAt: number; rates: LiveDirectionRates | null }>();
const gspCache = new Map<string, { fetchedAt: number; region: string | null }>();

async function fetchProductList(): Promise<OctopusProductSummary[]> {
    if (productListCache && Date.now() - productListCache.fetchedAt < PRODUCT_LIST_TTL_MS) {
        return productListCache.products;
    }
    if (productListInFlight) return productListInFlight;

    productListInFlight = (async () => {
        const response = await fetch('https://api.octopus.energy/v1/products/');
        if (!response.ok) throw new Error(`Octopus products request failed: ${response.status}`);
        const data: ProductListResponse = await response.json();
        productListCache = { fetchedAt: Date.now(), products: data.results };
        return data.results;
    })();

    try {
        return await productListInFlight;
    } finally {
        productListInFlight = null;
    }
}

function isResidentialDirectDebitProduct(product: OctopusProductSummary): boolean {
    if (product.is_prepay || product.is_business) return false;
    const name = product.display_name.toLowerCase();
    return !name.includes('pay as you go') && !name.includes('key and card');
}

/**
 * Find the current open Octopus product code matching a display-name substring.
 * Octopus periodically reissues fixed-term versions of the same tariff under a
 * new product code (e.g. "Cosy Octopus" -> "Cosy Octopus 12M Fixed"); when several
 * match, the most recently launched one is used. Returns null if nothing matches
 * (e.g. the tariff is currently closed to new customers) so callers can fall back
 * to the static preset rather than fail.
 */
async function findProductCode(
    nameContains: string,
    direction: 'IMPORT' | 'EXPORT',
    exclude?: string
): Promise<string | null> {
    const products = await fetchProductList();
    const needle = nameContains.toLowerCase();
    const excludeNeedle = exclude?.toLowerCase();

    const matches = products.filter(p =>
        p.direction === direction &&
        isResidentialDirectDebitProduct(p) &&
        p.display_name.toLowerCase().includes(needle) &&
        (!excludeNeedle || !p.display_name.toLowerCase().includes(excludeNeedle))
    );
    if (matches.length === 0) return null;

    matches.sort((a, b) => new Date(b.available_from).getTime() - new Date(a.available_from).getTime());
    return matches[0]?.code ?? null;
}

/** Resolve a UK postcode to its Octopus GSP (grid supply point) region letter, e.g. "C" */
export async function resolveGspRegion(postcode: string): Promise<string | null> {
    const key = postcode.trim().toUpperCase();
    if (!key) return null;

    const cached = gspCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < GSP_CACHE_TTL_MS) return cached.region;

    try {
        const response = await fetch(
            `https://api.octopus.energy/v1/industry/grid-supply-points/?postcode=${encodeURIComponent(key)}`
        );
        if (!response.ok) throw new Error(`GSP lookup failed: ${response.status}`);
        const data: { results: Array<{ group_id: string }> } = await response.json();
        const region = data.results[0]?.group_id.replace('_', '') ?? null;
        gspCache.set(key, { fetchedAt: Date.now(), region });
        return region;
    } catch {
        gspCache.set(key, { fetchedAt: Date.now(), region: null });
        return null;
    }
}

/**
 * Fetch and analyze live unit rates for a specific product + GSP region.
 *
 * For time-of-use tariffs, pulls the surrounding 48h of unit rates and derives
 * off-peak/standard/peak bands via OctopusEnergyClient.analyzeRates (the same
 * analysis used for a connected user's own actual tariff). For flat tariffs,
 * just takes whichever single rate covers right now, since a wider window
 * risks straddling a genuine quarterly price change and misreading it as a
 * fake time-of-use split.
 */
async function fetchLiveDirectionRates(
    productCode: string,
    region: string,
    timeOfUse: boolean
): Promise<LiveDirectionRates | null> {
    const cacheKey = `${productCode}:${region}:${timeOfUse}`;
    const cached = rateCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_TTL_MS) return cached.rates;

    try {
        const productResponse = await fetch(`https://api.octopus.energy/v1/products/${productCode}/`);
        if (!productResponse.ok) throw new Error(`Product detail request failed: ${productResponse.status}`);
        const productData: ProductDetailResponse = await productResponse.json();

        const regionTariffs = productData.single_register_electricity_tariffs?.[`_${region}`];
        const regionTariff = regionTariffs?.direct_debit_monthly ?? regionTariffs?.varying;
        if (!regionTariff) {
            rateCache.set(cacheKey, { fetchedAt: Date.now(), rates: null });
            return null;
        }

        const now = new Date();
        const windowMs = timeOfUse ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
        const from = new Date(now.getTime() - windowMs);
        const to = new Date(now.getTime() + windowMs);
        const ratesUrl = `https://api.octopus.energy/v1/products/${productCode}/electricity-tariffs/${regionTariff.code}/standard-unit-rates/` +
            `?period_from=${from.toISOString()}&period_to=${to.toISOString()}&page_size=200`;

        const ratesResponse = await fetch(ratesUrl);
        if (!ratesResponse.ok) throw new Error(`Unit rates request failed: ${ratesResponse.status}`);
        const ratesData: UnitRatesResponse = await ratesResponse.json();

        if (ratesData.results.length === 0) {
            rateCache.set(cacheKey, { fetchedAt: Date.now(), rates: null });
            return null;
        }

        const periods = ratesData.results.map(r => ({
            ratePence: r.value_inc_vat,
            validFrom: r.valid_from,
            validTo: r.valid_to,
        }));

        let rates: LiveDirectionRates;
        if (timeOfUse) {
            const analyzed = OctopusEnergyClient.analyzeRates(periods);
            rates = {
                standingChargePence: regionTariff.standing_charge_inc_vat,
                standardRatePence: analyzed.standard,
                offPeakRatePence: analyzed.offPeak,
                peakRatePence: analyzed.peak,
            };
        } else {
            const currentRate = OctopusEnergyClient.getRateForTimestamp(periods, now) ?? periods[0]?.ratePence;
            if (currentRate === undefined) {
                rateCache.set(cacheKey, { fetchedAt: Date.now(), rates: null });
                return null;
            }
            rates = {
                standingChargePence: regionTariff.standing_charge_inc_vat,
                standardRatePence: currentRate,
            };
        }

        rateCache.set(cacheKey, { fetchedAt: Date.now(), rates });
        return rates;
    } catch {
        rateCache.set(cacheKey, { fetchedAt: Date.now(), rates: null });
        return null;
    }
}

/**
 * Resolve live import/export rates for one tariff preset in a given GSP region.
 * Returns null if the preset has no live source or its product is currently
 * closed to new customers; only the fields Octopus actually returns are set,
 * so callers should spread this onto the static preset rather than replace it.
 */
export async function fetchLivePresetRates(presetKey: PresetKey, region: string): Promise<LivePresetRates | null> {
    const source = PRESET_PRODUCT_SOURCES[presetKey];
    if (!source) return null;

    const importProductCode = await findProductCode(source.importNameContains, 'IMPORT', source.importNameExcludes);
    if (!importProductCode) return null;

    const importRates = await fetchLiveDirectionRates(importProductCode, region, source.timeOfUse);
    if (!importRates) return null;

    const result: LivePresetRates = {
        import: {
            standardRatePence: importRates.standardRatePence,
            ...(importRates.standingChargePence !== undefined && { standingChargePence: importRates.standingChargePence }),
            ...(importRates.offPeakRatePence !== undefined &&
                importRates.offPeakRatePence !== importRates.standardRatePence &&
                { offPeakRatePence: importRates.offPeakRatePence }),
            ...(importRates.peakRatePence !== undefined &&
                importRates.peakRatePence !== importRates.standardRatePence &&
                { peakRatePence: importRates.peakRatePence }),
        },
        export: {},
    };

    if (source.exportNameContains) {
        const exportProductCode = await findProductCode(source.exportNameContains, 'EXPORT');
        if (exportProductCode) {
            const exportRates = await fetchLiveDirectionRates(exportProductCode, region, source.timeOfUse);
            if (exportRates) {
                // The peak band is the economically relevant number for time-of-use
                // export tariffs like Flux; flat exports only have standardRatePence.
                result.export.ratePence = exportRates.peakRatePence ?? exportRates.standardRatePence;
            }
        }
    }

    return result;
}
