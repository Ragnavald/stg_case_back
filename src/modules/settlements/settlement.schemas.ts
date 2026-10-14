import { z } from 'zod';

export const createSettlementSchema = z
  .object({
    fromUserId: z.number().int().positive(),
    toUserId: z.number().int().positive(),
    /** Decimal string in the group currency, e.g. "50.00". */
    amount: z.string().trim().min(1, 'Amount is required'),
  })
  .refine((s) => s.fromUserId !== s.toUserId, { message: 'Payer and receiver must be different people' });

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
