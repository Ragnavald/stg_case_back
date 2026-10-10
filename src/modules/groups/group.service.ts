import { AppError } from '../../middlewares/errorHandler';
import { currencyExponent, formatMoney } from '../../domain/money';
import { buildStatement, computeBalances, countPairwiseDebts, type Ledger } from '../../domain/ledger';
import { simplifyDebts } from '../../domain/settle';
import { toDateOnly } from '../../lib/http';
import { userRepository } from '../users/user.repository';
import { groupRepository, type GroupWithMembers } from './group.repository';
import type { CreateGroupInput, MemberRef } from './group.schemas';

// ---------------------------------------------------------------------------
// Guards shared with the expenses and settlements modules
// ---------------------------------------------------------------------------

export async function requireGroup(id: number): Promise<GroupWithMembers> {
  const group = await groupRepository.findById(id);
  if (!group) throw new AppError('Group not found', 404);
  return group;
}

export function requireOpen(group: GroupWithMembers) {
  if (group.status === 'CLOSED') throw new AppError('Group is closed; reopen it to make changes', 409);
}

export function requireMembers(group: GroupWithMembers, userIds: number[]) {
  const members = new Set(group.members.map((m) => m.userId));
  const outsiders = userIds.filter((id) => !members.has(id));
  if (outsiders.length > 0) throw new AppError(`User(s) ${outsiders.join(', ')} are not members of this group`);
}

// ---------------------------------------------------------------------------
// Presenters
// ---------------------------------------------------------------------------

function presentGroup(group: GroupWithMembers) {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    status: group.status,
    createdAt: group.createdAt,
    closedAt: group.closedAt,
    members: group.members.map((m) => ({ id: m.user.id, name: m.user.name })),
  };
}

/** Everything the settlement panel needs, derived from the ledger in one pass. */
function summarize(group: GroupWithMembers, ledger: Ledger, names: Map<number, string>) {
  const exp = currencyExponent(group.currency);
  const money = (v: bigint) => formatMoney(v, exp);
  const memberIds = group.members.map((m) => m.userId);
  const memberSet = new Set(memberIds);

  const breakdown = computeBalances(ledger, memberIds);
  const plan = simplifyDebts(new Map([...breakdown].map(([id, row]) => [id, row.balance])));
  const person = (id: number) => ({ id, name: names.get(id) ?? `#${id}` });

  const totalSpent = ledger.expenses.reduce((acc, e) => acc + e.amountMinor, 0n);

  // "Without vs with simplification" is measured on expenses alone: payments made by
  // following the simplified plan do not cancel pair-by-pair, so including them would
  // leave phantom pairwise debts in an already settled group.
  const expensesOnly: Ledger = { expenses: ledger.expenses, settlements: [] };
  const expenseBalances = computeBalances(expensesOnly);
  const simplifiedFromExpenses = simplifyDebts(new Map([...expenseBalances].map(([id, r]) => [id, r.balance])));

  return {
    currency: group.currency,
    status: group.status,
    totalSpent: money(totalSpent),
    isSettled: plan.length === 0,
    balances: [...breakdown]
      // former members only show up while they still have something to settle
      .filter(([id, row]) => memberSet.has(id) || row.balance !== 0n)
      .map(([id, row]) => ({
        user: person(id),
        isMember: memberSet.has(id),
        paid: money(row.paid),
        owed: money(row.owed),
        settlementsSent: money(row.sent),
        settlementsReceived: money(row.received),
        balance: money(row.balance),
      }))
      .sort((a, b) => a.user.name.localeCompare(b.user.name)),
    plan: plan.map((t) => ({ from: person(t.from), to: person(t.to), amount: money(t.amountMinor) })),
    stats: {
      pairwiseTransfers: countPairwiseDebts(expensesOnly),
      simplifiedTransfers: simplifiedFromExpenses.length,
    },
  };
}

/** Names for everyone who appears in the ledger, including former members. */
async function namesFor(group: GroupWithMembers, ledger: Ledger) {
  const names = new Map(group.members.map((m) => [m.userId, m.user.name]));
  const ids = new Set<number>();
  for (const e of ledger.expenses) {
    ids.add(e.payerId);
    for (const s of e.splits) ids.add(s.userId);
  }
  for (const s of ledger.settlements) ids.add(s.fromUserId).add(s.toUserId);
  const missing = [...ids].filter((id) => !names.has(id));
  if (missing.length > 0) {
    for (const u of await userRepository.findByIds(missing)) names.set(u.id, u.name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------

export const groupService = {
  async list() {
    const groups = await groupRepository.findAll();
    const totals = await groupRepository.totalSpentByGroup(groups.map((g) => g.id));
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      currency: g.currency,
      status: g.status,
      createdAt: g.createdAt,
      memberCount: g._count.members,
      expenseCount: g._count.expenses,
      totalSpent: formatMoney(totals.get(g.id) ?? 0n, currencyExponent(g.currency)),
    }));
  },

  async getById(id: number) {
    return presentGroup(await requireGroup(id));
  },

  async create(input: CreateGroupInput) {
    const userIds = [...new Set(input.members.flatMap((m) => ('userId' in m ? [m.userId] : [])))];
    const newNames = input.members.flatMap((m) => ('name' in m ? [m.name] : []));

    if (userIds.length > 0) {
      const found = await userRepository.findByIds(userIds);
      if (found.length !== userIds.length) {
        const known = new Set(found.map((u) => u.id));
        throw new AppError(`Unknown user(s): ${userIds.filter((id) => !known.has(id)).join(', ')}`);
      }
    }

    const group = await groupRepository.create({ name: input.name, currency: input.currency, userIds, newNames });
    return presentGroup(group);
  },

  async addMember(groupId: number, member: MemberRef) {
    const group = await requireGroup(groupId);
    requireOpen(group);

    if ('userId' in member) {
      if (group.members.some((m) => m.userId === member.userId)) {
        throw new AppError('User is already a member of this group', 409);
      }
      const [user] = await userRepository.findByIds([member.userId]);
      if (!user) throw new AppError('User not found', 404);
    }

    await groupRepository.addMember(groupId, member);
    return presentGroup(await requireGroup(groupId));
  },

  /** A member can only leave with a zero balance, so nobody walks away owing (or being owed) money. */
  async removeMember(groupId: number, userId: number) {
    const group = await requireGroup(groupId);
    requireOpen(group);
    requireMembers(group, [userId]);

    const ledger = await groupRepository.findLedger(groupId);
    const balance = computeBalances(ledger, [userId]).get(userId)!.balance;
    if (balance !== 0n) {
      const amount = formatMoney(balance < 0n ? -balance : balance, currencyExponent(group.currency));
      throw new AppError(
        `Member still ${balance < 0n ? 'owes' : 'is owed'} ${group.currency} ${amount}; settle up before removing`,
        409,
      );
    }

    await groupRepository.removeMember(groupId, userId);
    return presentGroup(await requireGroup(groupId));
  },

  async balances(groupId: number) {
    const group = await requireGroup(groupId);
    const ledger = await groupRepository.findLedger(groupId);
    return summarize(group, ledger, await namesFor(group, ledger));
  },

  async statement(groupId: number, userId: number) {
    const group = await requireGroup(groupId);
    const ledger = await groupRepository.findLedger(groupId);
    const names = await namesFor(group, ledger);
    if (!names.has(userId)) throw new AppError('User has no activity in this group', 404);

    const exp = currencyExponent(group.currency);
    const money = (v: bigint) => formatMoney(v, exp);
    const row = computeBalances(ledger, [userId]).get(userId)!;

    return {
      user: { id: userId, name: names.get(userId)! },
      currency: group.currency,
      summary: {
        paid: money(row.paid),
        owed: money(row.owed),
        settlementsSent: money(row.sent),
        settlementsReceived: money(row.received),
        balance: money(row.balance),
      },
      entries: buildStatement(ledger, userId).map((e) => ({
        type: e.type,
        refId: e.refId,
        // expenses carry a calendar day; settlements a full timestamp the client renders in local time
        date: e.type === 'EXPENSE' ? toDateOnly(e.date) : e.date.toISOString(),
        description: e.description,
        counterpart: e.counterpartId === null ? null : { id: e.counterpartId, name: names.get(e.counterpartId) ?? '' },
        paid: money(e.paidMinor),
        share: money(e.shareMinor),
        effect: money(e.effectMinor),
        runningBalance: money(e.runningBalanceMinor),
      })),
    };
  },

  /**
   * Closes the group. With `settleAll`, the current settlement plan is recorded as
   * paid first; otherwise every balance must already be zero.
   */
  async close(groupId: number, settleAll: boolean) {
    const group = await requireGroup(groupId);
    requireOpen(group);

    const ledger = await groupRepository.findLedger(groupId);
    const balances = computeBalances(ledger);
    const plan = simplifyDebts(new Map([...balances].map(([id, r]) => [id, r.balance])));

    if (plan.length > 0 && !settleAll) {
      throw new AppError(`Group still has ${plan.length} pending transfer(s); settle them before closing`, 409);
    }

    return presentGroup(await groupRepository.close(groupId, plan));
  },

  async reopen(groupId: number) {
    const group = await requireGroup(groupId);
    if (group.status === 'OPEN') throw new AppError('Group is already open', 409);
    return presentGroup(await groupRepository.reopen(groupId));
  },
};
