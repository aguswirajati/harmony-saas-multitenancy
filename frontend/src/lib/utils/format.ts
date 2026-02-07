/**
 * Format utilities for currency, numbers, and dates
 * Uses tenant-level format settings for regional preferences
 */

export interface FormatSettings {
  currency_code: string;
  currency_symbol_position: 'before' | 'after';
  decimal_separator: string;
  thousands_separator: string;
  price_decimal_places: number;
  quantity_decimal_places: number;
  date_format: string;
  timezone: string;
}

export const DEFAULT_FORMAT_SETTINGS: FormatSettings = {
  currency_code: 'IDR',
  currency_symbol_position: 'before',
  decimal_separator: ',',
  thousands_separator: '.',
  price_decimal_places: 0,
  quantity_decimal_places: 0,
  date_format: 'DD/MM/YYYY',
  timezone: 'Asia/Jakarta',
};

/**
 * Currency symbol lookup for common currencies
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  IDR: 'Rp',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  SGD: 'S$',
  MYR: 'RM',
  THB: '฿',
  PHP: '₱',
  VND: '₫',
  KRW: '₩',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  HKD: 'HK$',
  NZD: 'NZ$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  AED: 'د.إ',
  SAR: '﷼',
  BRL: 'R$',
  MXN: '$',
  ZAR: 'R',
  RUB: '₽',
  TRY: '₺',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
};

/**
 * Get currency symbol for a currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode;
}

/**
 * Format a number with the specified separators and decimal places
 */
export function formatNumber(
  value: number,
  decimals: number,
  settings: FormatSettings
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  // Round to specified decimal places
  const roundedValue = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);

  // Split into integer and decimal parts
  const [intPart, decPart] = roundedValue.toFixed(decimals).split('.');

  // Add thousands separators to integer part
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, settings.thousands_separator);

  // Combine with decimal part if needed
  if (decimals > 0 && decPart) {
    return `${formattedInt}${settings.decimal_separator}${decPart}`;
  }

  return formattedInt;
}

/**
 * Format a currency amount with symbol
 */
export function formatCurrency(
  amount: number,
  settings: FormatSettings
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '-';
  }

  const formattedNumber = formatNumber(amount, settings.price_decimal_places, settings);
  const symbol = getCurrencySymbol(settings.currency_code);

  if (settings.currency_symbol_position === 'before') {
    return `${symbol} ${formattedNumber}`;
  } else {
    return `${formattedNumber} ${symbol}`;
  }
}

/**
 * Format a quantity value
 */
export function formatQuantity(
  value: number,
  settings: FormatSettings
): string {
  return formatNumber(value, settings.quantity_decimal_places, settings);
}

/**
 * Format a date according to the format setting
 * Supports: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY
 */
export function formatDate(
  date: Date | string | null | undefined,
  settings: FormatSettings
): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '-';
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  switch (settings.date_format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'DD.MM.YYYY':
      return `${day}.${month}.${year}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Format a datetime with time
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  settings: FormatSettings,
  includeSeconds: boolean = false
): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '-';
  }

  const datePart = formatDate(d, settings);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  if (includeSeconds) {
    return `${datePart} ${hours}:${minutes}:${seconds}`;
  }

  return `${datePart} ${hours}:${minutes}`;
}

/**
 * Parse a number string with custom separators back to a number
 */
export function parseFormattedNumber(
  formattedValue: string,
  settings: FormatSettings
): number {
  if (!formattedValue || formattedValue === '-') {
    return 0;
  }

  // Remove currency symbol and trim
  let cleaned = formattedValue.trim();
  const symbol = getCurrencySymbol(settings.currency_code);
  cleaned = cleaned.replace(symbol, '').trim();

  // Remove thousands separators
  cleaned = cleaned.split(settings.thousands_separator).join('');

  // Replace decimal separator with dot
  cleaned = cleaned.replace(settings.decimal_separator, '.');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get preview text for format settings
 */
export function getFormatPreview(settings: FormatSettings): {
  currency: string;
  number: string;
  date: string;
} {
  const sampleAmount = 1234567.89;
  const sampleQuantity = 1234.5;
  const sampleDate = new Date();

  return {
    currency: formatCurrency(sampleAmount, settings),
    number: formatQuantity(sampleQuantity, settings),
    date: formatDate(sampleDate, settings),
  };
}

/**
 * Common date format options
 */
export const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '31/12/2024' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '12/31/2024' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2024-12-31' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY', example: '31-12-2024' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY', example: '31.12.2024' },
];

/**
 * Common currency options
 */
export const CURRENCY_OPTIONS = [
  { value: 'IDR', label: 'IDR - Indonesian Rupiah', symbol: 'Rp' },
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { value: 'SGD', label: 'SGD - Singapore Dollar', symbol: 'S$' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit', symbol: 'RM' },
  { value: 'JPY', label: 'JPY - Japanese Yen', symbol: '¥' },
  { value: 'CNY', label: 'CNY - Chinese Yuan', symbol: '¥' },
  { value: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { value: 'THB', label: 'THB - Thai Baht', symbol: '฿' },
  { value: 'PHP', label: 'PHP - Philippine Peso', symbol: '₱' },
  { value: 'VND', label: 'VND - Vietnamese Dong', symbol: '₫' },
  { value: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
];

/**
 * Common timezone options (subset for UI)
 */
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB, UTC+7)' },
  { value: 'Asia/Makassar', label: 'Asia/Makassar (WITA, UTC+8)' },
  { value: 'Asia/Jayapura', label: 'Asia/Jayapura (WIT, UTC+9)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur (MYT, UTC+8)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT, UTC+7)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (HKT, UTC+8)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST, UTC+8)' },
  { value: 'Asia/Manila', label: 'Asia/Manila (PHT, UTC+8)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (ICT, UTC+7)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT, UTC+11)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZDT, UTC+13)' },
  { value: 'Europe/London', label: 'Europe/London (GMT, UTC+0)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET, UTC+1)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET, UTC+1)' },
  { value: 'America/New_York', label: 'America/New_York (EST, UTC-5)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST, UTC-6)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST, UTC-8)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];
