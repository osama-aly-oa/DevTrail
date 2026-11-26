export const pageSize = 20;
export const maxOffset = 2_147_483_647;

const istanbulCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dayLabel = new Intl.DateTimeFormat('en', {
  timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
});

const timestampLabel = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Istanbul', dateStyle: 'medium',
});

export function todayInIstanbul(now = new Date()) {
  const parts = istanbulCalendar.formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value.padStart(4, '0');
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return [year, month, day].join('-');
}

export function isCalendarDate(value: string) {
  if (!/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function displayDate(value: string) {
  return dayLabel.format(new Date(value + 'T00:00:00Z'));
}

export function displayTimestamp(value: string) {
  return timestampLabel.format(new Date(value));
}

export function isId(value: string) {
  return /^[1-9][0-9]{0,18}$/.test(value) &&
    (value.length < 19 || value <= '9223372036854775807');
}

export function pageOffset(input: string | null) {
  if (!input || !/^(0|[1-9][0-9]{0,9})$/.test(input)) return 0;
  const offset = Number(input);
  return offset <= maxOffset ? offset : 0;
}

export function containsUnsupportedText(value: string) {
  return /[\u0000\p{Surrogate}]/u.test(value);
}

export function textError(value: string, label: string, max: number, required = false) {
  const trimmed = value.trim();
  if (required && !trimmed) return label + ' is required.';
  if (containsUnsupportedText(value)) return label + ' contains unsupported characters.';
  if (Array.from(trimmed).length > max) return label + ' must be at most ' + max + ' characters.';
  return undefined;
}

export function optionalText(value: string) {
  return value.trim() || null;
}
