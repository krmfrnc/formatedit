/**
 * Task 250: ISO-3166-1 alpha-2 country code → ISO-4217 currency.
 *
 * Eurozone members are collapsed to EUR. Anything not listed falls back to USD.
 * Source: ECB euro-area list + common payment-rails currencies.
 */
const EUROZONE = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE',
  'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
]);

const COUNTRY_CURRENCY: Record<string, string> = {
  TR: 'TRY',
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  BG: 'BGN',
  RU: 'RUB',
  UA: 'UAH',
  JP: 'JPY',
  CN: 'CNY',
  HK: 'HKD',
  TW: 'TWD',
  KR: 'KRW',
  SG: 'SGD',
  MY: 'MYR',
  TH: 'THB',
  ID: 'IDR',
  PH: 'PHP',
  VN: 'VND',
  IN: 'INR',
  PK: 'PKR',
  BD: 'BDT',
  AE: 'AED',
  SA: 'SAR',
  QA: 'QAR',
  KW: 'KWD',
  BH: 'BHD',
  OM: 'OMR',
  JO: 'JOD',
  IL: 'ILS',
  EG: 'EGP',
  ZA: 'ZAR',
  NG: 'NGN',
  KE: 'KES',
  MA: 'MAD',
  MX: 'MXN',
  BR: 'BRL',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  PE: 'PEN',
  UY: 'UYU',
};

export function currencyForCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return 'USD';
  const normalized = countryCode.trim().toUpperCase();
  if (normalized.length !== 2) return 'USD';
  if (EUROZONE.has(normalized)) return 'EUR';
  return COUNTRY_CURRENCY[normalized] ?? 'USD';
}
