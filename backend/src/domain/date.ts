import { HttpError } from '../middleware/error-handler.ts';

const istanbulCalendar = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Istanbul', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

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

export function sessionDateForWrite(value: string, now = new Date()) {
  if (value > todayInIstanbul(now)) {
    throw new HttpError(400, 'INVALID_INPUT', 'Session date cannot be in the future.');
  }
  return dateForDatabase(value);
}
