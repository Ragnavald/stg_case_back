import { AppError } from '../middlewares/errorHandler';
import { formatMoney, parseMoney, parseScaled } from './money';

export type SplitType = 'EQUAL' | 'PERCENT' | 'SHARES' | 'EXACT';

export interface SplitParticipant {
  userId: number;
  /** Percent ("33.3"), weight ("2") or exact amount ("60.00") depending on the split type. Ignored for EQUAL. */
  value?: string | undefined;
}

export interface SplitShare {
  userId: number;
  shareMinor: bigint;
  input: string | null;
}

/** Percentages and weights accept up to 4 decimal places (e.g. 33.3333%). */
export const WEIGHT_SCALE = 4;
const HUNDRED_PERCENT = 100n * 10n ** BigInt(WEIGHT_SCALE);

/**
 * Splits `amountMinor` proportionally to integer `weights` using the largest remainder
 * (Hamilton) method. The result always sums to `amountMinor` exactly and no two shares
 * differ from their exact proportional value by a full minor unit. Ties on the remainder
 * go to the lowest userId, so the result is deterministic.
 */
export function largestRemainder(
  amountMinor: bigint,
  weights: ReadonlyArray<{ userId: number; weight: bigint }>,
): Map<number, bigint> {
  const total = weights.reduce((acc, w) => acc + w.weight, 0n);
  if (total <= 0n) throw new AppError('Split weights must add up to more than zero');

  const rows = weights.map((w) => ({
    userId: w.userId,
    share: (amountMinor * w.weight) / total,
    remainder: (amountMinor * w.weight) % total,
  }));

  let leftover = amountMinor - rows.reduce((acc, r) => acc + r.share, 0n);
  const byRemainder = [...rows].sort((a, b) =>
    a.remainder === b.remainder ? a.userId - b.userId : a.remainder > b.remainder ? -1 : 1,
  );
  for (const row of byRemainder) {
    if (leftover === 0n) break;
    row.share += 1n;
    leftover -= 1n;
  }

  return new Map(rows.map((r) => [r.userId, r.share]));
}

/**
 * Turns a split request into per-participant shares in minor units.
 * Invariant: the returned shares always add up to `amountMinor`.
 */
export function computeSplits(
  amountMinor: bigint,
  type: SplitType,
  participants: ReadonlyArray<SplitParticipant>,
  exponent: number,
): SplitShare[] {
  if (amountMinor <= 0n) throw new AppError('Amount must be greater than zero');
  if (participants.length === 0) throw new AppError('At least one participant is required');

  const ids = new Set(participants.map((p) => p.userId));
  if (ids.size !== participants.length) throw new AppError('Participants must not repeat');

  const requireValue = (p: SplitParticipant): string => {
    if (p.value === undefined || p.value.trim() === '') {
      throw new AppError(`Missing ${type.toLowerCase()} value for participant ${p.userId}`);
    }
    return p.value.trim();
  };

  switch (type) {
    case 'EQUAL': {
      const shares = largestRemainder(
        amountMinor,
        participants.map((p) => ({ userId: p.userId, weight: 1n })),
      );
      return participants.map((p) => ({ userId: p.userId, shareMinor: shares.get(p.userId)!, input: null }));
    }

    case 'PERCENT':
    case 'SHARES': {
      const weights = participants.map((p) => {
        const input = requireValue(p);
        const label = type === 'PERCENT' ? 'Percentage' : 'Weight';
        return { userId: p.userId, input, weight: parseScaled(input, WEIGHT_SCALE, label) };
      });

      if (type === 'PERCENT') {
        const sum = weights.reduce((acc, w) => acc + w.weight, 0n);
        if (sum !== HUNDRED_PERCENT) {
          throw new AppError(`Percentages must add up to 100 (got ${formatMoney(sum, WEIGHT_SCALE)})`);
        }
      }

      const shares = largestRemainder(amountMinor, weights);
      return weights.map((w) => ({ userId: w.userId, shareMinor: shares.get(w.userId)!, input: w.input }));
    }

    case 'EXACT': {
      const rows = participants.map((p) => {
        const input = requireValue(p);
        return { userId: p.userId, input, shareMinor: parseMoney(input, exponent, 'Exact amount') };
      });

      const sum = rows.reduce((acc, r) => acc + r.shareMinor, 0n);
      if (sum !== amountMinor) {
        const diff = amountMinor - sum;
        const what = diff > 0n ? 'missing' : 'over';
        throw new AppError(
          `Exact amounts add up to ${formatMoney(sum, exponent)} but the expense is ` +
            `${formatMoney(amountMinor, exponent)} (${formatMoney(diff < 0n ? -diff : diff, exponent)} ${what})`,
        );
      }
      return rows;
    }
  }
}
