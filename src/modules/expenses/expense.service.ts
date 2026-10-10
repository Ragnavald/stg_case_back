import { AppError } from '../../middlewares/errorHandler';
import { currencyExponent, formatMoney, parseMoney } from '../../domain/money';
import { computeSplits } from '../../domain/split';
import { toDateOnly } from '../../lib/http';
import { requireGroup, requireMembers, requireOpen } from '../groups/group.service';
import { expenseRepository, type ExpenseWithDetails } from './expense.repository';
import type { CreateExpenseInput } from './expense.schemas';

function presentExpense(e: ExpenseWithDetails, exponent: number) {
  return {
    id: e.id,
    description: e.description,
    amount: formatMoney(e.amountMinor, exponent),
    splitType: e.splitType,
    date: toDateOnly(e.date),
    createdAt: e.createdAt,
    payer: { id: e.payer.id, name: e.payer.name },
    splits: e.splits.map((s) => ({
      user: { id: s.user.id, name: s.user.name },
      share: formatMoney(s.shareMinor, exponent),
      input: s.input,
    })),
  };
}

/** Expense dates are calendar days; allow "tomorrow" in UTC so users ahead of UTC are not rejected. */
function parseExpenseDate(date: string | undefined): Date {
  const today = toDateOnly(new Date());
  const value = date ?? today;
  const limit = toDateOnly(new Date(Date.now() + 24 * 60 * 60 * 1000));
  if (value > limit) throw new AppError('Expense date cannot be in the future');
  return new Date(`${value}T00:00:00Z`);
}

export const expenseService = {
  async list(groupId: number) {
    const group = await requireGroup(groupId);
    const exponent = currencyExponent(group.currency);
    const expenses = await expenseRepository.findByGroup(groupId);
    return expenses.map((e) => presentExpense(e, exponent));
  },

  async create(groupId: number, input: CreateExpenseInput) {
    const group = await requireGroup(groupId);
    requireOpen(group);
    requireMembers(group, [input.payerId, ...input.participants.map((p) => p.userId)]);

    const exponent = currencyExponent(group.currency);
    const amountMinor = parseMoney(input.amount, exponent);
    const splits = computeSplits(amountMinor, input.splitType, input.participants, exponent);

    const expense = await expenseRepository.create({
      groupId,
      payerId: input.payerId,
      description: input.description,
      amountMinor,
      splitType: input.splitType,
      date: parseExpenseDate(input.date),
      splits,
    });
    return presentExpense(expense, exponent);
  },

  async remove(groupId: number, expenseId: number) {
    const group = await requireGroup(groupId);
    requireOpen(group);
    const expense = await expenseRepository.findById(groupId, expenseId);
    if (!expense) throw new AppError('Expense not found', 404);
    await expenseRepository.delete(expenseId);
  },
};
