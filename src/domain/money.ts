import { AppError } from '../middlewares/errorHandler';

/** ISO 4217 minor-unit exponents. No code path assumes a fixed `100`. */
export const CURRENCY_EXPONENTS: Readonly<Record<string, number>> = {
  BRL: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  ARS: 2,
  CLP: 0,
  JPY: 0,
  KWD: 3,
  BHD: 3,
};

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const DECIMAL_RE = /^\d+(\.\d+)?$/;

export function currencyExponent(code: string): number {
  const exponent = CURRENCY_EXPONENTS[code];
  if (exponent === undefined) throw new AppError(`Unsupported currency: ${code}`);
  return exponent;
}

/**
 * Parses a non-negative decimal string into an integer scaled by 10^scale.
 * Text-based on purpose: never goes through `parseFloat`.
 */
export function parseScaled(value: string, scale: number, label = 'Value'): bigint {
  const text = value.trim();
  if (!DECIMAL_RE.test(text)) throw new AppError(`${label} must be a non-negative decimal like "12.34"`);

  const [intPart = '0', fracPart = ''] = text.split('.');
  if (fracPart.length > scale) {
    throw new AppError(`${label} has more than ${scale} decimal place(s)`);
  }

  const scaled = BigInt(intPart) * 10n ** BigInt(scale) + BigInt(fracPart.padEnd(scale, '0') || '0');
  if (scaled > MAX_SAFE) throw new AppError(`${label} is too large`);
  return scaled;
}

/** Parses a money string (e.g. "100.50") into minor units of a currency with the given exponent. */
export function parseMoney(value: string, exponent: number, label = 'Amount'): bigint {
  return parseScaled(value, exponent, label);
}

/** Formats minor units as a plain decimal string ("-12.34"); presentation is left to the client. */
export function formatMoney(minor: bigint, exponent: number): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const base = 10n ** BigInt(exponent);
  const int = (abs / base).toString();
  const frac = exponent > 0 ? '.' + (abs % base).toString().padStart(exponent, '0') : '';
  return `${negative ? '-' : ''}${int}${frac}`;
}
