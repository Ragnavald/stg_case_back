import { z } from 'zod';

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(120),
  /** Decimal string in the group currency, e.g. "100.00". Never a float. */
  amount: z.string().trim().min(1, 'Amount is required'),
  payerId: z.number().int().positive(),
  /** YYYY-MM-DD; defaults to today. */
  date: z.iso.date().optional(),
  splitType: z.enum(['EQUAL', 'PERCENT', 'SHARES', 'EXACT']),
  participants: z
    .array(
      z.object({
        userId: z.number().int().positive(),
        value: z.string().optional(),
      }),
    )
    .min(1, 'At least one participant is required'),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
