import { describe, expect, it } from 'vitest';
import { EXACT_LIMIT, simplifyDebts, type Transfer } from '../../src/domain/settle';

const balances = (entries: Record<number, number>) =>
  new Map(Object.entries(entries).map(([id, v]) => [Number(id), BigInt(v)]));

/** Applies the transfers and returns what is left; must be all zeros. */
function residual(input: Map<number, bigint>, transfers: Transfer[]) {
  const left = new Map(input);
  for (const t of transfers) {
    expect(t.amountMinor > 0n).toBe(true);
    expect(t.from).not.toBe(t.to);
    left.set(t.from, left.get(t.from)! + t.amountMinor);
    left.set(t.to, left.get(t.to)! - t.amountMinor);
  }
  return [...left.values()].filter((v) => v !== 0n);
}

/** Brute force: n − (max number of disjoint zero-sum subsets), over non-zero balances. */
function optimalCount(values: bigint[]): number {
  const nz = values.filter((v) => v !== 0n);
  const n = nz.length;
  const best = new Map<number, number>();
  const solve = (mask: number): number => {
    if (mask === 0) return 0;
    if (best.has(mask)) return best.get(mask)!;
    const first = mask & -mask;
    const rest = mask ^ first;
    let result = -Infinity;
    // choose the zero-sum group containing the lowest member
    for (let sub = rest; ; sub = (sub - 1) & rest) {
      const group = sub | first;
      let s = 0n;
      for (let i = 0; i < n; i++) if (group & (1 << i)) s += nz[i]!;
      if (s === 0n) result = Math.max(result, 1 + solve(mask ^ group));
      if (sub === 0) break;
    }
    best.set(mask, result);
    return result;
  };
  return n === 0 ? 0 : n - solve((1 << n) - 1);
}

describe('simplifyDebts', () => {
  it('collapses a chain: A owes B 50, B owes C 50 → A pays C 50', () => {
    // A=1, B=2, C=3. B received 50 and owes 50 → net 0.
    const input = balances({ 1: -5000, 2: 0, 3: 5000 });
    expect(simplifyDebts(input)).toEqual([{ from: 1, to: 3, amountMinor: 5000n }]);
  });

  it('returns nothing for an already settled group', () => {
    expect(simplifyDebts(balances({ 1: 0, 2: 0 }))).toEqual([]);
  });

  it('beats plain greedy by finding zero-sum subgroups', () => {
    // Largest-debtor-pays-largest-creditor gives 4 transfers:
    //   1→4 R$4, 2→3 R$3, 1→5 R$2, 2→5 R$1
    // but {2: -4, 4: +4} and {1: -6, 3: +3, 5: +3} settle independently in 1 + 2 = 3.
    const input = balances({ 1: -600, 2: -400, 3: 300, 4: 400, 5: 300 });
    const result = simplifyDebts(input);
    expect(residual(input, result)).toEqual([]);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ from: 2, to: 4, amountMinor: 400n });
  });

  it('is optimal on random groups (checked against brute force)', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

    for (let round = 0; round < 300; round++) {
      const n = 2 + Math.floor(rand() * 9);
      const values: bigint[] = [];
      for (let i = 0; i < n - 1; i++) values.push(BigInt(Math.floor(rand() * 21) - 10) * 100n);
      values.push(-values.reduce((a, b) => a + b, 0n));
      const input = new Map(values.map((v, i) => [i + 1, v]));

      const result = simplifyDebts(input);
      expect(residual(input, result)).toEqual([]);
      expect(result).toHaveLength(optimalCount(values));
    }
  });

  it('stays correct (≤ n−1 transfers) above the exact limit', () => {
    const n = EXACT_LIMIT + 8;
    const values = Array.from({ length: n - 1 }, (_, i) => BigInt(((i * 37) % 19) - 9) * 113n);
    values.push(-values.reduce((a, b) => a + b, 0n));
    const input = new Map(values.map((v, i) => [i + 1, v]));

    const result = simplifyDebts(input);
    expect(residual(input, result)).toEqual([]);
    expect(result.length).toBeLessThanOrEqual(values.filter((v) => v !== 0n).length - 1);
  });

  it('refuses balances that do not add up to zero', () => {
    expect(() => simplifyDebts(balances({ 1: -100, 2: 99 }))).toThrow(/add up to zero/);
  });
});
