import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createTransport } from './api';

const session = {
  owner: { username: 'fixture' }, csrfToken: 'fixture-token', expiresAt: '2026-12-01T12:00:00Z',
};

function reply(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  const response = { config, data, status, statusText: '', headers: new AxiosHeaders() };
  if (status >= 400) throw new AxiosError('Request failed', undefined, config, undefined, response);
  return response;
}

function setup(adapter: AxiosAdapter) {
  let token: string | undefined = session.csrfToken;
  const expired = vi.fn(() => { token = undefined; });
  const refreshed = vi.fn((value: typeof session) => { token = value.csrfToken; });
  return {
    api: createTransport({ token: () => token, expired, refreshed }, adapter),
    expired,
    refreshed,
  };
}

describe('API transport', () => {
  it('keeps decimal identifiers and sends the token only on writes', async () => {
    const adapter = vi.fn<AxiosAdapter>(async config => reply(config, { data: '9007199254740993' }));
    const { api } = setup(adapter);
    await expect(api({ url: '/projects/9007199254740993' })).resolves.toEqual({ data: '9007199254740993' });
    await api({ url: '/projects/9007199254740993', method: 'delete' });
    const reads = adapter.mock.calls[0]?.[0];
    const writes = adapter.mock.calls[1]?.[0];
    expect(reads?.baseURL).toBe('/api/v1');
    expect(reads?.headers.get('X-CSRF-Token')).toBeUndefined();
    expect(writes?.headers.get('X-CSRF-Token')).toBe(session.csrfToken);
    expect(writes?.data).toBeUndefined();
  });

  it('distinguishes expired sessions from rejected credentials', async () => {
    const adapter: AxiosAdapter = async config => reply(config, {
      error: {
        code: config.url === '/auth/login' ? 'INVALID_CREDENTIALS' : 'UNAUTHENTICATED',
        message: 'Fixture error.',
      },
    }, 401);
    const { api, expired } = setup(adapter);
    await expect(api({ url: '/auth/login', method: 'post' }, false)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(expired).not.toHaveBeenCalled();
    await expect(api({ url: '/projects' })).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('refreshes a rotated CSRF token and retries a rejected write once', async () => {
    const next = { ...session, csrfToken: 'rotated-fixture-token' };
    const adapter = vi.fn<AxiosAdapter>(async config => {
      if (config.url === '/auth/me') return reply(config, { data: next });
      if (config.headers.get('X-CSRF-Token') !== next.csrfToken) {
        return reply(config, { error: { code: 'CSRF_FORBIDDEN', message: 'Fixture error.' } }, 403);
      }
      return reply(config, undefined, 204);
    });
    const { api, refreshed } = setup(adapter);
    await api({ url: '/sessions/1', method: 'delete' });
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual(['/sessions/1', '/auth/me', '/sessions/1']);
    expect(refreshed).toHaveBeenCalledWith(next);
  });

  it('sanitizes network failures and does not retry unrelated errors', async () => {
    const adapter = vi.fn<AxiosAdapter>(async () => { throw new Error('unexpected private details'); });
    const { api } = setup(adapter);
    await expect(api({ url: '/projects' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR', message: 'Could not reach DevTrail. Check the connection and try again.',
    });
    expect(adapter).toHaveBeenCalledOnce();
  });
});
