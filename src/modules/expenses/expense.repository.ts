import { prisma } from '../../config/db';
import type { Prisma } from '../../generated/prisma/client';
import type { SplitShare, SplitType } from '../../domain/split';

const withDetails = {
  payer: true,
  splits: { include: { user: true }, orderBy: { userId: 'asc' } },
} satisfies Prisma.ExpenseInclude;

export type ExpenseWithDetails = Prisma.ExpenseGetPayload<{ include: typeof withDetails }>;

export const expenseRepository = {
  findByGroup(groupId: number): Promise<ExpenseWithDetails[]> {
    return prisma.expense.findMany({
      where: { groupId },
      include: withDetails,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  },

  findById(groupId: number, id: number) {
    return prisma.expense.findFirst({ where: { id, groupId } });
  },

  /** The expense and its splits are written in a single statement, so they can never diverge. */
  create(data: {
    groupId: number;
    payerId: number;
    description: string;
    amountMinor: bigint;
    splitType: SplitType;
    date: Date;
    splits: SplitShare[];
  }): Promise<ExpenseWithDetails> {
    const { splits, ...expense } = data;
    return prisma.expense.create({
      data: {
        ...expense,
        splits: { create: splits.map((s) => ({ userId: s.userId, shareMinor: s.shareMinor, input: s.input })) },
      },
      include: withDetails,
    });
  },

  delete(id: number) {
    return prisma.expense.delete({ where: { id } });
  },
};
