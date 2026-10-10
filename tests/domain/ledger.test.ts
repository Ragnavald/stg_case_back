import { describe, expect, it } from 'vitest';
import { buildStatement, computeBalances, countPairwiseDebts, type Ledger } from '../../src/domain/ledger';

const day = (d: string) => new Date(`${d}T00:00:00Z`);

// A=1, B=2, C=3
// A pays 100 split by A,B → B owes A 50
// B pays 100 split by B,C → C owes B 50
const chain: Ledger = {
  expenses: [
    {
      id: 1, description: 'Jantar', date: day('2026-10-01'), createdAt: day('2026-10-01'),
      payerId: 1, amountMinor: 10000n,
      splits: [{ userId: 1, shareMinor: 5000n }, { userId: 2, shareMinor: 5000n }],
    },
    {
      id: 2, description: 'Uber', date: day('2026-10-02'), createdAt: day('2026-10-02'),
      payerId: 2, amountMinor: 10000n,
      splits: [{ userId: 2, shareMinor: 5000n }, { userId: 3, shareMinor: 5000n }],
    },
  ],
  settlements: [],
};

describe('computeBalances', () => {
  it('derives net balances that sum to zero', () => {
    const b = computeBalances(chain, [1, 2, 3]);
    expect(b.get(1)!.balance).toBe(5000n);
    expect(b.get(2)!.balance).toBe(0n);
    expect(b.get(3)!.balance).toBe(-5000n);
    expect([...b.values()].reduce((acc, r) => acc + r.balance, 0n)).toBe(0n);
  });

  it('a settlement moves the payer up and the receiver down', () => {
    const b = computeBalances({
      ...chain,
      settlements: [{ id: 1, createdAt: day('2026-10-03'), fromUserId: 3, toUserId: 1, amountMinor: 5000n }],
    });
    expect([...b.values()].every((r) => r.balance === 0n)).toBe(true);
  });

  it('includes members with no activity', () => {
    expect(computeBalances(chain, [9]).get(9)!.balance).toBe(0n);
  });
});

describe('countPairwiseDebts', () => {
  it('counts one debt per pair of people that still owe each other', () => {
    expect(countPairwiseDebts(chain)).toBe(2);
  });
});

describe('buildStatement', () => {
  it('lists every movement with a running balance that ends at the net balance', () => {
    const ledger: Ledger = {
      ...chain,
      settlements: [{ id: 7, createdAt: day('2026-10-05'), fromUserId: 3, toUserId: 1, amountMinor: 2000n }],
    };
    const rows = buildStatement(ledger, 1);
    expect(rows.map((r) => [r.type, r.effectMinor, r.runningBalanceMinor])).toEqual([
      ['EXPENSE', 5000n, 5000n],
      ['SETTLEMENT_RECEIVED', -2000n, 3000n],
    ]);
    expect(rows.at(-1)!.runningBalanceMinor).toBe(computeBalances(ledger).get(1)!.balance);
  });

  it('skips expenses the user is not part of', () => {
    expect(buildStatement(chain, 3).map((r) => r.refId)).toEqual([2]);
  });
});
