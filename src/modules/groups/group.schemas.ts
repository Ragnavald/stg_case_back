import { z } from 'zod';
import { CURRENCY_EXPONENTS } from '../../domain/money';

/** A member is either an existing user or a new person created on the fly by name. */
export const memberRefSchema = z.union([
  z.object({ userId: z.number().int().positive() }),
  z.object({ name: z.string().trim().min(1, 'Name is required').max(80) }),
]);

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => c in CURRENCY_EXPONENTS, 'Unsupported currency')
    .default('BRL'),
  members: z.array(memberRefSchema).min(1, 'Add at least one member'),
});

export type MemberRef = z.infer<typeof memberRefSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
