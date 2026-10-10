import { AppError } from '../../middlewares/errorHandler';
import { currencyExponent, formatMoney } from '../../domain/money';
import { computeBalances } from '../../domain/ledger';
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
};
