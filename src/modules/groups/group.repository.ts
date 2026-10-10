import { prisma } from '../../config/db';
import type { Prisma } from '../../generated/prisma/client';
import type { Ledger } from '../../domain/ledger';

const withMembers = {
  members: { include: { user: true }, orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }] },
} satisfies Prisma.GroupInclude;

export type GroupWithMembers = Prisma.GroupGetPayload<{ include: typeof withMembers }>;

export const groupRepository = {
  findAll() {
    return prisma.group.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true, expenses: true } } },
    });
  },

  async totalSpentByGroup(groupIds: number[]): Promise<Map<number, bigint>> {
    const rows = await prisma.expense.groupBy({
      by: ['groupId'],
      where: { groupId: { in: groupIds } },
      _sum: { amountMinor: true },
    });
    return new Map(rows.map((r) => [r.groupId, r._sum.amountMinor ?? 0n]));
  },

  findById(id: number): Promise<GroupWithMembers | null> {
    return prisma.group.findUnique({ where: { id }, include: withMembers });
  },

  /** Creates the group, any new people listed by name, and all memberships atomically. */
  create(data: { name: string; currency: string; userIds: number[]; newNames: string[] }): Promise<GroupWithMembers> {
    return prisma.$transaction(async (tx) => {
      const created = await Promise.all(data.newNames.map((name) => tx.user.create({ data: { name } })));
      const userIds = [...data.userIds, ...created.map((u) => u.id)];
      return tx.group.create({
        data: {
          name: data.name,
          currency: data.currency,
          members: { create: userIds.map((userId) => ({ userId })) },
        },
        include: withMembers,
      });
    });
  },

  async addMember(groupId: number, member: { userId: number } | { name: string }) {
    return prisma.$transaction(async (tx) => {
      const userId = 'userId' in member ? member.userId : (await tx.user.create({ data: { name: member.name } })).id;
      await tx.groupMember.create({ data: { groupId, userId } });
      return userId;
    });
  },

  removeMember(groupId: number, userId: number) {
    return prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });
  },

  async findLedger(groupId: number): Promise<Ledger> {
    const [expenses, settlements] = await Promise.all([
      prisma.expense.findMany({
        where: { groupId },
        include: { splits: { select: { userId: true, shareMinor: true } } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.settlement.findMany({ where: { groupId }, orderBy: { createdAt: 'asc' } }),
    ]);
    return { expenses, settlements };
  },
};
