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
export const boundedText = text;

export const webUrl = requiredText(2048).refine(value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && /^https?:\/\//i.test(value);
  } catch {
    return false;
  }
});

export const labels = z.array(requiredText(80)).max(24).transform(values => {
  const labels = new Map<string, string>();
  for (const value of values) {
    const display = value.normalize('NFC');
    const key = display.toLowerCase();
    if (!labels.has(key)) labels.set(key, display);
  }
  return [...labels.values()];
});

export const links = z.array(webUrl).max(24).transform(values => [...new Set(values)]);
export const linkedSessionIds = z.array(id).max(100).transform(values => [...new Set(values)]);

export const activityCategories = z.enum([
  'Feature Development', 'Bug Fixing', 'Learning', 'Refactoring', 'Testing', 'Architecture & System Design',
  'Documentation', 'DevOps & Deployment', 'Code Review',
]);

export function containsText(value: string) {
  return { contains: value.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const };
}

export const calendarDate = z.iso.date().refine(value => !value.startsWith('0000-'));

export const username = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
export const password = z.string().refine(value => !/[\u0000\p{Surrogate}]/u.test(value))
  .refine(value => Array.from(value).length >= 1 && Array.from(value).length <= 256);
