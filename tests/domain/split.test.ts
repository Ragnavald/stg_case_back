import { describe, expect, it } from 'vitest';
import { computeSplits } from '../../src/domain/split';

const shares = (rows: { userId: number; shareMinor: bigint }[]) => rows.map((r) => r.shareMinor);
const sum = (rows: { shareMinor: bigint }[]) => rows.reduce((acc, r) => acc + r.shareMinor, 0n);

describe('computeSplits — EQUAL', () => {
  it('splits R$ 100 among 4 people evenly', () => {
    const rows = computeSplits(10000n, 'EQUAL', [{ userId: 1 }, { userId: 2 }, { userId: 3 }, { userId: 4 }], 2);
    expect(shares(rows)).toEqual([2500n, 2500n, 2500n, 2500n]);
  });

  it('never loses the cent: R$ 100 / 3 = 33.34 + 33.33 + 33.33', () => {
    const rows = computeSplits(10000n, 'EQUAL', [{ userId: 3 }, { userId: 1 }, { userId: 2 }], 2);
    expect(sum(rows)).toBe(10000n);
    // leftover cent goes to the lowest userId, regardless of input order
    expect(rows.find((r) => r.userId === 1)!.shareMinor).toBe(3334n);
  });

  it('keeps every share within 1 minor unit of each other', () => {
    for (let amount = 1n; amount < 200n; amount++) {
      const rows = computeSplits(amount, 'EQUAL', [1, 2, 3, 4, 5, 6, 7].map((userId) => ({ userId })), 2);
      const values = shares(rows);
      expect(sum(rows)).toBe(amount);
      const max = values.reduce((a, b) => (a > b ? a : b));
      const min = values.reduce((a, b) => (a < b ? a : b));
      expect(max - min <= 1n).toBe(true);
    }
  });
});

describe('computeSplits — PERCENT', () => {
  it('splits by percentage and closes the sum', () => {
    const rows = computeSplits(
      10000n,
      'PERCENT',
      [
        { userId: 1, value: '33.3' },
        { userId: 2, value: '33.3' },
        { userId: 3, value: '33.4' },
      ],
      2,
    );
    expect(shares(rows)).toEqual([3330n, 3330n, 3340n]);
  });

  it('rejects percentages that do not add up to 100', () => {
    expect(() =>
      computeSplits(10000n, 'PERCENT', [
        { userId: 1, value: '50' },
        { userId: 2, value: '30' },
      ], 2),
    ).toThrow(/add up to 100 \(got 80.0000\)/);
  });

  it('requires a value per participant', () => {
    expect(() => computeSplits(10000n, 'PERCENT', [{ userId: 1, value: '100' }, { userId: 2 }], 2)).toThrow(/Missing/);
  });
});

describe('computeSplits — SHARES', () => {
  it('splits by weight 2:1:1', () => {
    const rows = computeSplits(10000n, 'SHARES', [
      { userId: 1, value: '2' },
      { userId: 2, value: '1' },
      { userId: 3, value: '1' },
    ], 2);
    expect(shares(rows)).toEqual([5000n, 2500n, 2500n]);
  });

  it('rejects all-zero weights (division by zero)', () => {
    expect(() => computeSplits(10000n, 'SHARES', [{ userId: 1, value: '0' }, { userId: 2, value: '0' }], 2)).toThrow(
      /more than zero/,
    );
  });
});

describe('computeSplits — EXACT', () => {
  it('accepts fixed amounts that add up to the total', () => {
    const rows = computeSplits(10000n, 'EXACT', [
      { userId: 1, value: '60.00' },
      { userId: 2, value: '40' },
    ], 2);
    expect(shares(rows)).toEqual([6000n, 4000n]);
  });

  it('explains the difference when amounts do not match', () => {
    expect(() =>
      computeSplits(10000n, 'EXACT', [
        { userId: 1, value: '60' },
        { userId: 2, value: '30' },
      ], 2),
    ).toThrow(/90.00 .* 100.00 \(10.00 missing\)/);
  });
});

describe('computeSplits — common validation', () => {
  it('rejects empty and duplicated participants', () => {
    expect(() => computeSplits(100n, 'EQUAL', [], 2)).toThrow(/At least one/);
    expect(() => computeSplits(100n, 'EQUAL', [{ userId: 1 }, { userId: 1 }], 2)).toThrow(/repeat/);
  });

  it('rejects non-positive totals', () => {
    expect(() => computeSplits(0n, 'EQUAL', [{ userId: 1 }], 2)).toThrow(/greater than zero/);
  });
});
