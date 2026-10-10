/**
 * Debt simplification: given each person's net balance (positive = should receive,
 * negative = owes), produce the smallest set of transfers that zeroes everybody.
 *
 * Why this is optimal: any set of transfers forms a graph whose connected components
 * each have zero total balance, and a component with k people needs at least k-1
 * transfers. So the minimum is `n - (max number of disjoint zero-sum groups)`.
 * Finding that partition is NP-hard in general (it generalises subset-sum), but the
 * bitmask DP below is O(2^n · n) and exact for the group sizes this product sees.
 * Above EXACT_LIMIT people it falls back to a greedy that is still bounded by n-1.
 */

export interface Transfer {
  from: number;
  to: number;
  amountMinor: bigint;
}

export const EXACT_LIMIT = 16;

interface Party {
  userId: number;
  balance: bigint;
}

export function simplifyDebts(balances: ReadonlyMap<number, bigint>): Transfer[] {
  const parties: Party[] = [...balances.entries()]
    .filter(([, balance]) => balance !== 0n)
    .map(([userId, balance]) => ({ userId, balance }))
    .sort((a, b) => a.userId - b.userId);

  const total = parties.reduce((acc, p) => acc + p.balance, 0n);
  if (total !== 0n) throw new Error(`Balances must add up to zero (got ${total})`);
  if (parties.length === 0) return [];

  const groups = parties.length <= EXACT_LIMIT ? zeroSumPartition(parties) : greedyPartition(parties);
  return groups.flatMap(settleGroup);
}

/**
 * Exact partition into the maximum number of disjoint zero-sum groups.
 *
 * dp[mask] = max number of complete zero-sum groups that can be "closed" while
 * adding the members of `mask` one by one. Adding a member to `mask \ {i}` closes a
 * group exactly when sum(mask) === 0, so dp[mask] = max_i dp[mask \ {i}] + [sum(mask) = 0].
 * Walking the argmax chain back from the full mask yields an ordering whose zero-sum
 * prefixes are the group boundaries.
 */
function zeroSumPartition(parties: Party[]): Party[][] {
  const n = parties.length;
  const size = 1 << n;
  const sum: bigint[] = new Array(size).fill(0n);
  const dp = new Int8Array(size);
  const choice = new Int8Array(size);

  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;
    sum[mask] = sum[mask ^ low]! + parties[31 - Math.clz32(low)]!.balance;

    let best = -1;
    for (let i = 0; i < n; i++) {
      const bit = 1 << i;
      if ((mask & bit) && dp[mask ^ bit]! > best) {
        best = dp[mask ^ bit]!;
        choice[mask] = i;
      }
    }
    dp[mask] = best + (sum[mask] === 0n ? 1 : 0);
  }

  const groups: Party[][] = [];
  let current: Party[] = [];
  for (let mask = size - 1; mask !== 0; ) {
    if (sum[mask] === 0n && current.length > 0) {
      groups.push(current);
      current = [];
    }
    const i = choice[mask]!;
    current.push(parties[i]!);
    mask ^= 1 << i;
  }
  groups.push(current);
  return groups;
}

/** Large-group fallback: pair off exact opposite balances first, then treat the rest as one group. */
function greedyPartition(parties: Party[]): Party[][] {
  const groups: Party[][] = [];
  const rest: Party[] = [];
  const waiting = new Map<bigint, Party[]>();

  for (const p of parties) {
    const match = waiting.get(-p.balance);
    if (match && match.length > 0) {
      groups.push([match.shift()!, p]);
    } else {
      const queue = waiting.get(p.balance) ?? [];
      queue.push(p);
      waiting.set(p.balance, queue);
    }
  }
  for (const queue of waiting.values()) rest.push(...queue);
  if (rest.length > 0) groups.push(rest);
  return groups;
}

/**
 * Settles one zero-sum group: the largest debtor pays the largest creditor, repeatedly.
 * Each step zeroes at least one person, so a group of k people needs at most k-1 transfers.
 */
function settleGroup(group: Party[]): Transfer[] {
  const debtors = group.filter((p) => p.balance < 0n).map((p) => ({ ...p, left: -p.balance }));
  const creditors = group.filter((p) => p.balance > 0n).map((p) => ({ ...p, left: p.balance }));
  const byLeftDesc = (a: { left: bigint; userId: number }, b: { left: bigint; userId: number }) =>
    a.left === b.left ? a.userId - b.userId : a.left > b.left ? -1 : 1;

  const transfers: Transfer[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byLeftDesc);
    creditors.sort(byLeftDesc);
    const debtor = debtors[0]!;
    const creditor = creditors[0]!;
    const amount = debtor.left < creditor.left ? debtor.left : creditor.left;

    transfers.push({ from: debtor.userId, to: creditor.userId, amountMinor: amount });
    debtor.left -= amount;
    creditor.left -= amount;
    if (debtor.left === 0n) debtors.shift();
    if (creditor.left === 0n) creditors.shift();
  }
  return transfers;
}
