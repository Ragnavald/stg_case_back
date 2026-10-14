import { AppError } from '../../middlewares/errorHandler';
import { currencyExponent, formatMoney, parseMoney } from '../../domain/money';
import { requireGroup, requireMembers, requireOpen } from '../groups/group.service';
import { settlementRepository, type SettlementWithUsers } from './settlement.repository';
import type { CreateSettlementInput } from './settlement.schemas';

function presentSettlement(s: SettlementWithUsers, exponent: number) {
  return {
    id: s.id,
    from: { id: s.from.id, name: s.from.name },
    to: { id: s.to.id, name: s.to.name },
    amount: formatMoney(s.amountMinor, exponent),
    createdAt: s.createdAt,
  };
}

export const settlementService = {
  async list(groupId: number) {
    const group = await requireGroup(groupId);
    const exponent = currencyExponent(group.currency);
    return (await settlementRepository.findByGroup(groupId)).map((s) => presentSettlement(s, exponent));
  },

  /** Records a payment between two members (e.g. one transfer of the settlement plan). */
  async create(groupId: number, input: CreateSettlementInput) {
    const group = await requireGroup(groupId);
    requireOpen(group);
    requireMembers(group, [input.fromUserId, input.toUserId]);

    const exponent = currencyExponent(group.currency);
    const amountMinor = parseMoney(input.amount, exponent);
    if (amountMinor <= 0n) throw new AppError('Amount must be greater than zero');

    const settlement = await settlementRepository.create({
      groupId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      amountMinor,
    });
    return presentSettlement(settlement, exponent);
  },

  /** Undo a payment recorded by mistake. */
  async remove(groupId: number, settlementId: number) {
    const group = await requireGroup(groupId);
    requireOpen(group);
    const settlement = await settlementRepository.findById(groupId, settlementId);
    if (!settlement) throw new AppError('Settlement not found', 404);
    await settlementRepository.delete(settlementId);
  },
};
