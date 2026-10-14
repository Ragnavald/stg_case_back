import { describe, expect, it } from 'vitest';
import { parseId } from '../../src/lib/http';

describe('parseId', () => {
  it('accepts positive integers', () => {
    expect(parseId('42')).toBe(42);
  });

  it('rejects anything that is not a positive integer with a 400', () => {
    for (const bad of [undefined, '', 'abc', '0', '-1', '1.5', '1e3x']) {
      expect(() => parseId(bad)).toThrow(/Invalid id/);
    }
  });
});
