import { HttpError } from '../middleware/error-handler.ts';

const istanbulCalendar = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Istanbul', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
});
const istanbulOffset = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Istanbul', timeZoneName: 'longOffset',
});
const dayMs = 86_400_000;

export function todayInIstanbul(now = new Date()) {
  const parts = istanbulCalendar.formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value.padStart(4, '0');
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return [year, month, day].join('-');
}

export function dateForDatabase(value: string) {
  return new Date(value + 'T00:00:00.000Z');
}

export function shiftCalendarDate(value: string, amount: number) {
  return new Date(dateForDatabase(value).valueOf() + dayMs * amount).toISOString().split('T')[0];
}

function offsetAt(date: Date) {
  const zone = istanbulOffset.formatToParts(date).find(part => part.type === 'timeZoneName')?.value;
  const offset = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(zone ?? '');
  if (!offset) return 0;
  const [, sign, hours, minutes, seconds] = offset;
  return (sign === '-' ? -1 : 1) * (+hours * 3600 + +minutes * 60 + +(seconds ?? 0)) * 1000;
}

export function startOfIstanbulDate(value: string) {
  const utc = dateForDatabase(value).valueOf();
  const before = utc - offsetAt(new Date(utc - dayMs / 2));
  const after = utc - offsetAt(new Date(utc + dayMs / 2));
  const local = (time: number) => time + offsetAt(new Date(time));
  const exact = [before, after].filter(time => local(time) === utc);
  if (exact.length) return new Date(Math.min(...exact));

  // Some historical timezone transitions skip midnight entirely.
  let low = Math.min(before, after);
  let high = Math.max(before, after);
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (local(middle) < utc) low = middle + 1;
    else high = middle;
  }
  return new Date(low);
}

export function sessionDateForWrite(value: string, now = new Date()) {
  if (value > todayInIstanbul(now)) {
    throw new HttpError(400, 'INVALID_INPUT', 'Session date cannot be in the future.');
  }
  return dateForDatabase(value);
}
