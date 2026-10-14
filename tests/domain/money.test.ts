import { describe, expect, it } from 'vitest';
import { currencyExponent, formatMoney, parseMoney } from '../../src/domain/money';

describe('parseMoney', () => {
  it('parses decimals into minor units without floats', () => {
    expect(parseMoney('100', 2)).toBe(10000n);
    expect(parseMoney('0.1', 2)).toBe(10n);
    expect(parseMoney('19.99', 2)).toBe(1999n);
    expect(parseMoney('3000', 0)).toBe(3000n);
    expect(parseMoney('12.345', 3)).toBe(12345n);
  });

  it('rejects more precision than the currency allows', () => {
    expect(() => parseMoney('10.005', 2)).toThrow(/decimal place/);
    expect(() => parseMoney('3000.5', 0)).toThrow(/decimal place/);
  });

  it('rejects malformed and negative input', () => {
    for (const bad of ['', 'abc', '-1', '1,50', '1e3', '.5', '1.']) {
      expect(() => parseMoney(bad, 2)).toThrow();
    }
  });

  it('rejects values beyond the safe integer range', () => {
    expect(() => parseMoney('90071992547409.92', 2)).toThrow(/too large/);
  });
});

describe('formatMoney', () => {
  it('formats according to the exponent', () => {
    expect(formatMoney(1999n, 2)).toBe('19.99');
    expect(formatMoney(5n, 2)).toBe('0.05');
    expect(formatMoney(-1250n, 2)).toBe('-12.50');
    expect(formatMoney(3000n, 0)).toBe('3000');
    expect(formatMoney(12345n, 3)).toBe('12.345');
  });
});

describe('currencyExponent', () => {
  it('knows ISO 4217 exponents and rejects unknown codes', () => {
    expect(currencyExponent('BRL')).toBe(2);
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('KWD')).toBe(3);
    expect(() => currencyExponent('XXX')).toThrow(/Unsupported currency/);
  });
});
