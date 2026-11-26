import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import type { Request, RequestHandler } from 'express';
import { HttpError } from './error-handler.ts';

export const noStore: RequestHandler = (_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
};

export const requireHttps: RequestHandler = (request, _response, next) => {
  if (!request.secure) throw new HttpError(403, 'HTTPS_REQUIRED', 'HTTPS is required.');
  next();
};

export function requireOrigin(origin: string): RequestHandler {
  return (request, _response, next) => {
    let actual = request.get('Origin');
    if (actual === undefined) {
      try {
        const referer = new URL(request.get('Referer') ?? '');
        if (referer.protocol === 'https:' || referer.protocol === 'http:') actual = referer.origin;
      } catch {
        // An absent or malformed Referer cannot establish the request origin.
      }
    }
    if (actual !== origin) throw new HttpError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed.');
    next();
  };
}

export function activeSession(request: Request) {
  const login = request.session?.login;
  return login && login.expiresAt > Date.now() ? login : undefined;
}

export const requireAuthentication: RequestHandler = (request, _response, next) => {
  if (!activeSession(request)) throw new HttpError(401, 'UNAUTHENTICATED', 'Login is required.');
  next();
};

export const requireCsrf: RequestHandler = (request, _response, next) => {
  const expected = request.session?.login?.csrfToken;
  const provided = request.get('X-CSRF-Token');
  if (!expected || !/^[a-f0-9]{64}$/.test(expected) || !provided || !/^[a-f0-9]{64}$/.test(provided) ||
      !timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new HttpError(403, 'CSRF_FORBIDDEN', 'A valid CSRF token is required.');
  }
  next();
};

export const requireCsrfIfAuthenticated: RequestHandler = (request, response, next) => {
  if (activeSession(request)) requireCsrf(request, response, next);
  else next();
};

export const requireJson: RequestHandler = (request, _response, next) => {
  if (!request.is('application/json')) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send an application/json request body.');
  }
  next();
};

export const parseJson = express.json({ limit: '256kb', inflate: false });

export const rejectBody: RequestHandler = (request, _response, next) => {
  const length = request.get('Content-Length');
  if ((length !== undefined && length !== '0') || request.get('Transfer-Encoding') !== undefined) {
    throw new HttpError(400, 'INVALID_INPUT', 'This route does not accept a request body.');
  }
  next();
};
