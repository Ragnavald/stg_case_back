import { AppError } from '../middlewares/errorHandler';

/** Parses a positive integer route param, answering 400 instead of letting NaN reach the database. */
export function parseId(value: string | undefined, label = 'id'): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(`Invalid ${label}`);
  return id;
}

/** Formats a DATE column as YYYY-MM-DD. */
export const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);
