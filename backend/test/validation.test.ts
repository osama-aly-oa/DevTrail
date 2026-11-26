import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.ts';
import { sessionDateForWrite, todayInIstanbul } from '../src/domain/date.ts';
import { calendarDate, id, optionalText, requiredText } from '../src/validation.ts';

describe('Istanbul calendar dates', () => {
  it('advances at Istanbul midnight while UTC is still the previous date', () => {
    const before = new Date('2026-11-26T20:59:59.999Z');
    const midnight = new Date('2026-11-26T21:00:00.000Z');
    expect(todayInIstanbul(before)).toBe('2026-11-26');
    expect(todayInIstanbul(midnight)).toBe('2026-11-27');
    expect(() => sessionDateForWrite('2026-11-27', before)).toThrow('Session date cannot be in the future.');
    expect(sessionDateForWrite('2026-11-27', midnight).toISOString()).toBe('2026-11-27T00:00:00.000Z');
  });

  it('accepts real Gregorian dates across the supported date range', () => {
    expect(calendarDate.parse('0001-01-01')).toBe('0001-01-01');
    expect(calendarDate.parse('2024-02-29')).toBe('2024-02-29');
    for (const value of ['0000-01-01', '2026-02-29', '2024-04-31', '2024-01-01T00:00:00Z', '2024-1-01']) {
      expect(calendarDate.safeParse(value).success).toBe(false);
    }
  });
});

describe('wire validation', () => {
  it('parses BIGINT without going through Number', () => {
    expect(id.parse('9223372036854775807')).toBe(9223372036854775807n);
    for (const value of ['9223372036854775808', '0', '01', '+1', '1e8', '1.0', '9'.repeat(1000), 1]) {
      expect(id.safeParse(value).success).toBe(false);
    }
  });

  it('counts code points and rejects strings PostgreSQL cannot represent', () => {
    expect(requiredText(2).parse(' 🐢é ')).toBe('🐢é');
    expect(optionalText(2).parse('\uFEFF\u2003')).toBeNull();
    for (const invalid of ['🧪🐢é', '\t\u00A0', 'a\u0000', '\ud800']) {
      expect(requiredText(2).safeParse(invalid).success).toBe(false);
    }
  });
});

describe('runtime configuration', () => {
  const env = {
    APP_ORIGIN: 'https://devtrail.example',
    DATABASE_URL: 'postgresql://127.0.0.1/devtrail',
    SESSION_SECRET: 'a'.repeat(64),
    NODE_ENV: 'production',
  };

  it('requires HTTPS for deployed origins and trusts only configured IP addresses', () => {
    expect(readConfig(env)).toMatchObject({ secureCookies: true, trustedProxies: [], port: 3000 });
    expect(() => readConfig({ ...env, APP_ORIGIN: 'http://127.0.0.1:3000' })).toThrow('HTTPS');
    expect(() => readConfig({ ...env, APP_ORIGIN: 'https://devtrail.example/path' })).toThrow('HTTPS');
    expect(() => readConfig({ ...env, TRUSTED_PROXY_IPS: '0.0.0.0/0' })).toThrow('IP addresses');
    expect(() => readConfig({ ...env, TRUSTED_PROXY_IPS: 'true' })).toThrow('IP addresses');
    expect(readConfig({ ...env, TRUSTED_PROXY_IPS: '192.0.2.1, ::1' }).trustedProxies).toEqual(['192.0.2.1', '::1']);
  });

  it('rejects invalid startup values without echoing the supplied value', () => {
    expect(() => readConfig({ ...env, PORT: '90000' })).toThrow('Invalid PORT');
    expect(() => readConfig({ ...env, DATABASE_URL: 'sensitive' })).toThrow(/^DATABASE_URL must be/);
    expect(() => readConfig({ ...env, SESSION_SECRET: 'sensitive' })).toThrow(/^SESSION_SECRET must be/);
    expect(() => readConfig({ ...env, DATABASE_URL: env.DATABASE_URL + '?schema=unsafe%22' })).toThrow(/^DATABASE_URL schema must be/);
  });
});
