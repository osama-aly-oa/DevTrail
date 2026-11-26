import { z } from 'zod';
import { HttpError } from './middleware/error-handler.ts';

export function parse<T>(schema: z.ZodType<T>, value: unknown, location: 'body' | 'query' | 'path'): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, 'INVALID_INPUT', `Invalid request ${location}.`);
  }
  return result.data;
}

export const emptyObject = z.strictObject({});

export const id = z.string().regex(/^[1-9][0-9]{0,18}$/)
  .refine(value => value.length < 19 || value <= '9223372036854775807')
  .transform(value => BigInt(value));
export const idPath = z.strictObject({ id });

const offset = z.string().regex(/^(0|[1-9][0-9]{0,9})$/).transform(Number).pipe(z.number().max(2_147_483_647));
const limit = z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number).pipe(z.number().max(100));
export const pageFields = { offset: offset.default(0), limit: limit.default(20) };

function text(max: number) {
  return z.string().refine(value => !/[\u0000\p{Surrogate}]/u.test(value)).transform(value => value.trim())
    .refine(value => Array.from(value).length <= max);
}

export const requiredText = (max: number) => text(max).refine(value => value.length > 0);
export const optionalText = (max: number) => text(max).nullable().transform(value => value || null);

export const calendarDate = z.iso.date().refine(value => !value.startsWith('0000-'));

export const username = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
export const password = z.string().refine(value => !/[\u0000\p{Surrogate}]/u.test(value))
  .refine(value => Array.from(value).length >= 1 && Array.from(value).length <= 256);
