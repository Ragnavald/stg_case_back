/**
 * Balances are always derived from expenses and settlements, never stored.
 *
 *   balance(u) = Σ paid − Σ owed + Σ settlements sent − Σ settlements received
 *
 * Positive = the group owes u; negative = u owes the group. Everything is integer
 * minor units, so Σ balance over the group is exactly zero.
 */

export interface LedgerExpense {
  id: number;
  description: string;
  date: Date;
  createdAt: Date;
  payerId: number;
  amountMinor: bigint;
  splits: ReadonlyArray<{ userId: number; shareMinor: bigint }>;
}

export interface LedgerSettlement {
  id: number;
  createdAt: Date;
  fromUserId: number;
  toUserId: number;
  amountMinor: bigint;
}

export interface Ledger {
  expenses: ReadonlyArray<LedgerExpense>;
  settlements: ReadonlyArray<LedgerSettlement>;
}

export interface BalanceBreakdown {
  paid: bigint;
  owed: bigint;
  sent: bigint;
  received: bigint;
  balance: bigint;
}

const emptyBreakdown = (): BalanceBreakdown => ({ paid: 0n, owed: 0n, sent: 0n, received: 0n, balance: 0n });

export function computeBalances(ledger: Ledger, userIds: Iterable<number> = []): Map<number, BalanceBreakdown> {
  const result = new Map<number, BalanceBreakdown>();
  const get = (id: number) => {
    let row = result.get(id);
    if (!row) result.set(id, (row = emptyBreakdown()));
    return row;
  };
  for (const id of userIds) get(id);

  for (const e of ledger.expenses) {
    get(e.payerId).paid += e.amountMinor;
    for (const s of e.splits) get(s.userId).owed += s.shareMinor;
  }
  for (const s of ledger.settlements) {
    get(s.fromUserId).sent += s.amountMinor;
    get(s.toUserId).received += s.amountMinor;
  }
  for (const row of result.values()) row.balance = row.paid - row.owed + row.sent - row.received;
  return result;
}

/**
 * How many transfers the group would need without simplification: every participant
 * pays back each payer directly, netted only within the same pair of people.
 */
export function countPairwiseDebts(ledger: Ledger): number {
  const net = new Map<string, bigint>();
  const add = (debtor: number, creditor: number, amount: bigint) => {
    if (debtor === creditor) return;
    const [a, b] = debtor < creditor ? [debtor, creditor] : [creditor, debtor];
    const key = `${a}:${b}`;
    net.set(key, (net.get(key) ?? 0n) + (debtor === a ? amount : -amount));
  };

  for (const e of ledger.expenses) for (const s of e.splits) add(s.userId, e.payerId, s.shareMinor);
  for (const s of ledger.settlements) add(s.toUserId, s.fromUserId, s.amountMinor);

  return [...net.values()].filter((v) => v !== 0n).length;
}

export type StatementEntryType = 'EXPENSE' | 'SETTLEMENT_SENT' | 'SETTLEMENT_RECEIVED';

export interface StatementEntry {
  type: StatementEntryType;
  refId: number;
  date: Date;
  description: string;
  /** Amount the user paid out of pocket for an expense (0 if someone else paid). */
  paidMinor: bigint;
  /** The user's share of an expense (0 for settlements). */
  shareMinor: bigint;
  /** Effect on the user's balance. */
  effectMinor: bigint;
  runningBalanceMinor: bigint;
  counterpartId: number | null;
}

/** Chronological list of everything that moved a user's balance, with a running total. */
export function buildStatement(ledger: Ledger, userId: number): StatementEntry[] {
  type Pending = Omit<StatementEntry, 'runningBalanceMinor'> & { sortKey: number };
  const rows: Pending[] = [];

  for (const e of ledger.expenses) {
    const paid = e.payerId === userId ? e.amountMinor : 0n;
    const share = e.splits.find((s) => s.userId === userId)?.shareMinor ?? 0n;
    if (paid === 0n && share === 0n) continue;
    rows.push({
      type: 'EXPENSE',
      refId: e.id,
      date: e.date,
      description: e.description,
      paidMinor: paid,
      shareMinor: share,
      effectMinor: paid - share,
      counterpartId: e.payerId === userId ? null : e.payerId,
      sortKey: e.createdAt.getTime(),
    });
  }

  for (const s of ledger.settlements) {
    if (s.fromUserId !== userId && s.toUserId !== userId) continue;
    const sent = s.fromUserId === userId;
    rows.push({
      type: sent ? 'SETTLEMENT_SENT' : 'SETTLEMENT_RECEIVED',
      refId: s.id,
      date: s.createdAt,
      description: sent ? 'Settlement sent' : 'Settlement received',
      paidMinor: 0n,
      shareMinor: 0n,
      effectMinor: sent ? s.amountMinor : -s.amountMinor,
      counterpartId: sent ? s.toUserId : s.fromUserId,
      sortKey: s.createdAt.getTime(),
    });
  }

  rows.sort((a, b) => dayOf(a.date) - dayOf(b.date) || a.sortKey - b.sortKey);

  let running = 0n;
  return rows.map(({ sortKey: _sortKey, ...row }) => {
    running += row.effectMinor;
    return { ...row, runningBalanceMinor: running };
  });
}

const dayOf = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
