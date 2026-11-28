import axios from 'axios';
import type { AxiosAdapter, AxiosRequestConfig } from 'axios';

export interface AuthSession {
  owner: { username: string };
  csrfToken: string;
  expiresAt: string;
}

export interface Resource<T> {
  data: T;
}

export interface Page<T> {
  data: T[];
  pagination: { offset: number; limit: number; hasMore: boolean };
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function toApiError(error: unknown) {
  if (axios.isAxiosError<{ error?: { code?: unknown; message?: unknown } }>(error) && error.response) {
    const { status, data } = error.response;
    const code = data?.error?.code;
    const message = data?.error?.message;
    if (typeof code === 'string' && typeof message === 'string') return new ApiError(status, code, message);
    return new ApiError(status, 'UNEXPECTED_RESPONSE', 'DevTrail returned an unexpected response. Try again.');
  }
  return new ApiError(0, 'NETWORK_ERROR', 'Could not reach DevTrail. Check the connection and try again.');
}

interface SessionCallbacks {
  token: () => string | undefined;
  expired: () => void;
  refreshed: (session: AuthSession) => void;
}

export function createTransport(auth: SessionCallbacks, adapter?: AxiosAdapter) {
  const client = axios.create({
    baseURL: '/api/v1',
    allowAbsoluteUrls: false,
    withXSRFToken: false,
    timeout: 15_000,
    adapter,
  });

  async function send<T>(config: AxiosRequestConfig, token?: string) {
    const isWrite = ['post', 'put', 'patch', 'delete'].includes(config.method ?? '');
    const response = await client.request<T>({
      ...config,
      headers: isWrite && token ? { 'X-CSRF-Token': token } : undefined,
    });
    return response.data;
  }

  return async function request<T>(config: AxiosRequestConfig, protectedRoute = true): Promise<T> {
    let token = auth.token();
    try {
      try {
        return await send<T>(config, token);
      } catch (error) {
        const rejected = toApiError(error);
        if (rejected.code !== 'CSRF_FORBIDDEN' || config.signal?.aborted) throw rejected;

        // A different tab can replace the cookie. The backend rejected this write before mutation.
        if (auth.token() === token) {
          const current = await send<Resource<AuthSession>>({ url: '/auth/me', signal: config.signal });
          if (auth.token() === token && protectedRoute) auth.refreshed(current.data);
          token = protectedRoute ? auth.token() : current.data.csrfToken;
        } else {
          token = auth.token();
        }
        if (!token) throw rejected;
        return await send<T>(config, token);
      }
    } catch (error) {
      const failure = error instanceof ApiError ? error : toApiError(error);
      if (protectedRoute && failure.code === 'UNAUTHENTICATED' && token && auth.token() === token) {
        auth.expired();
      }
      throw failure;
    }
  };
}
