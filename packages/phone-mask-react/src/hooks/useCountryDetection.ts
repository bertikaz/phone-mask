import { useState, useEffect, useMemo, useCallback } from 'react';
import { MasksFull, MasksFullEn, MasksFullMap, MasksFullMapEn, type CountryKey, type MaskFull } from '@desource/phone-mask';
import { GEO_IP_URL, GEO_IP_TIMEOUT, CACHE_KEY, CACHE_EXPIRY_MS } from '../consts';

// ── Shared utilities ────────────────────────────────────────────────

/** Get navigator language with SSR safety */
export function getNavigatorLang(): string {
  return typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';
}

/** Resolve country data by ISO code */
export function getCountry(code: string, locale: string): MaskFull {
  const isEn = locale.toLowerCase().startsWith('en');
  const map = isEn ? MasksFullMapEn : MasksFullMap(locale);
  const id = code.toUpperCase() as CountryKey;
  const data = map[id] || map.US;
  return { id: (map[id] ? id : 'US') as CountryKey, ...data };
}

/** Try to resolve a country; returns null when code is unknown */
export function tryGetCountry(code: string, locale: string): MaskFull | null {
  const isEn = locale.toLowerCase().startsWith('en');
  const map = isEn ? MasksFullMapEn : MasksFullMap(locale);
  const id = code.toUpperCase() as CountryKey;
  const data = map[id];
  return data ? { id, ...data } : null;
}

/** Build the full sorted country list for a locale (uses pre-built arrays like Vue) */
export function getCountries(locale: string): MaskFull[] {
  const isEn = locale.toLowerCase().startsWith('en');
  return isEn ? MasksFullEn : MasksFull(locale);
}

// ── Detection helpers ───────────────────────────────────────────────

function detectFromLocale(countries: MaskFull[]): string | null {
  const lang = typeof navigator !== 'undefined' ? navigator.language || '' : '';

  try {
    if (Intl.Locale) {
      const loc = new Intl.Locale(lang);
      if (loc?.region && countries.some((c) => c.id === loc.region!.toUpperCase())) {
        return loc.region!.toUpperCase();
      }
    }
  } catch { /* ignore */ }

  const parts = lang.split(/[-_]/);
  if (parts.length > 1) {
    const region = parts[1]!.toUpperCase();
    if (countries.some((c) => c.id === region)) return region;
  }

  return null;
}

async function detectByGeoIp(countries: MaskFull[]): Promise<string | null> {
  const hasCountry = (code: string) => countries.some((c) => c.id === code);

  // Check localStorage cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { country_code?: string; ts: number };
      const expired = Date.now() - parsed.ts > CACHE_EXPIRY_MS;
      if (!expired && parsed.country_code && hasCountry(parsed.country_code.toUpperCase())) {
        return parsed.country_code.toUpperCase();
      }
      if (expired) localStorage.removeItem(CACHE_KEY);
    }
  } catch { /* ignore */ }

  // Fetch from geo-IP service
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), GEO_IP_TIMEOUT);
  try {
    const res = await fetch(GEO_IP_URL, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = (json.country || json.country_code || json.countryCode || json.country_code2 || '')
      .toString()
      .toUpperCase();
    if (hasCountry(raw)) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ country_code: raw, ts: Date.now() })); } catch { /* ignore */ }
      return raw;
    }
  } catch { /* ignore */ }
  finally { clearTimeout(t); }

  return null;
}

// ── Hook ────────────────────────────────────────────────────────────

export interface UseCountryDetectionOptions {
  /** Fixed country ISO code (disables dropdown when set) */
  country?: string;
  /** Whether to auto-detect country via geo-IP + locale fallback */
  detect?: boolean;
  /** Locale for country name translations */
  locale?: string;
  /** Callback when country changes */
  onCountryChange?: (country: MaskFull) => void;
}

export interface UseCountryDetectionReturn {
  /** Resolved locale string */
  locale: string;
  /** Current country data */
  country: MaskFull;
  /** Update country programmatically */
  setCountry: (code: string) => void;
  /** Full list of countries (for dropdown) */
  countries: MaskFull[];
  /** Whether the dropdown should be shown */
  hasDropdown: boolean;
}

export function useCountryDetection(options: UseCountryDetectionOptions): UseCountryDetectionReturn {
  const locale = options.locale || getNavigatorLang();

  const [country, setCountryState] = useState<MaskFull>(() =>
    getCountry(options.country || 'US', locale)
  );

  const countries = useMemo(() => getCountries(locale), [locale]);
  const [hasDropdown, setHasDropdown] = useState(!options.country);

  // Country initialization and detection
  useEffect(() => {
    setHasDropdown(!options.country && countries.length > 1);

    (async () => {
      // If a fixed country prop is set, use it
      if (options.country) {
        const newCountry = getCountry(options.country, locale);
        setCountryState((prev) => {
          if (prev.id === newCountry.id) return prev;
          options.onCountryChange?.(newCountry);
          return newCountry;
        });
        return;
      }

      if (!options.detect) return;

      // Try geo-IP first, then locale fallback
      const geo = await detectByGeoIp(countries);
      if (geo) {
        const detected = getCountry(geo, locale);
        setCountryState((prev) => {
          if (prev.id === detected.id) return prev;
          options.onCountryChange?.(detected);
          return detected;
        });
        return;
      }

      const loc = detectFromLocale(countries);
      if (loc) {
        const detected = getCountry(loc, locale);
        setCountryState((prev) => {
          if (prev.id === detected.id) return prev;
          options.onCountryChange?.(detected);
          return detected;
        });
      }
    })();
  }, [options.country, options.detect, countries, locale]);

  const setCountry = useCallback(
    (code: string) => {
      const newCountry = getCountry(code, locale);
      setCountryState(newCountry);
      options.onCountryChange?.(newCountry);
    },
    [locale, options.onCountryChange]
  );

  return { locale, country, setCountry, countries, hasDropdown };
}
