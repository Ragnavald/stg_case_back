import { prisma } from '../../config/db';
import type { Prisma } from '../../generated/prisma/client';

const withUsers = { from: true, to: true } satisfies Prisma.SettlementInclude;

export type SettlementWithUsers = Prisma.SettlementGetPayload<{ include: typeof withUsers }>;

export const settlementRepository = {
  findByGroup(groupId: number): Promise<SettlementWithUsers[]> {
    return prisma.settlement.findMany({ where: { groupId }, include: withUsers, orderBy: { createdAt: 'desc' } });
  },

  findById(groupId: number, id: number) {
    return prisma.settlement.findFirst({ where: { id, groupId } });
  },

  create(data: { groupId: number; fromUserId: number; toUserId: number; amountMinor: bigint }) {
    return prisma.settlement.create({ data, include: withUsers });
  },

  delete(id: number) {
    return prisma.settlement.delete({ where: { id } });
  },
};
