import { describe, expect, it } from 'vitest';
import { displayDate, isCalendarDate, isId, pageOffset, textError, todayInIstanbul } from './domain';

describe('domain boundaries', () => {
  it('advances at Istanbul midnight and preserves date-only display', () => {
    expect(todayInIstanbul(new Date('2026-01-01T20:59:59Z'))).toBe('2026-01-01');
    expect(todayInIstanbul(new Date('2026-01-01T21:00:00Z'))).toBe('2026-01-02');
    expect(displayDate('2026-01-02')).toContain('January 2');
  });

  it('checks Gregorian dates and preserves IDs beyond Number precision', () => {
    expect(isCalendarDate('0001-01-01')).toBe(true);
    expect(isCalendarDate('2000-02-29')).toBe(true);
    expect(isCalendarDate('1900-02-29')).toBe(false);
    expect(isCalendarDate('0000-10-10')).toBe(false);
    expect(isId('9007199254740993')).toBe(true);
    expect(isId('9223372036854775807')).toBe(true);
    expect(isId('9223372036854775808')).toBe(false);
    expect(isId('01')).toBe(false);
  });

  it('counts trimmed Unicode code points and rejects unsupported characters', () => {
    expect(textError('  🐱🛠  ', 'Name', 2, true)).toBeUndefined();
    expect(textError('🐱🛠!', 'Name', 2, true)).toMatch(/2 characters/);
    expect(textError('   ', 'Name', 120, true)).toMatch(/required/);
    expect(textError('x\u0000', 'Name', 120)).toMatch(/unsupported/);
    expect(textError('\ud800', 'Name', 120)).toMatch(/unsupported/);
  });

  it('validates URL offsets within the API bounds', () => {
    expect(pageOffset('20')).toBe(20);
    expect(pageOffset('2147483647')).toBe(2_147_483_647);
    for (const value of [null, '-20', '1e2', '0002', '2147483648']) {
      expect(pageOffset(value)).toBe(0);
    }
  });
});
