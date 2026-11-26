import { randomBytes } from 'node:crypto';
import cookieSignature from 'cookie-signature';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Config } from '../config.ts';
import type { Database } from '../database.ts';
import { HttpError } from '../middleware/error-handler.ts';
import {
  activeSession, noStore, parseJson, rejectBody, requireAuthentication, requireCsrf, requireCsrfIfAuthenticated,
  requireHttps, requireJson, requireOrigin,
} from '../middleware/security.ts';
import { emptyObject, parse, password, username } from '../validation.ts';
import { createOwnerAuthenticator } from './owner.ts';
import { sessionLifetimeMs } from './session.ts';
import type { LoginSession, SessionInfrastructure } from './session.ts';

const loginBody = z.strictObject({ username, password });

function loginResponse({ username, csrfToken, expiresAt }: LoginSession) {
  return { data: { owner: { username }, csrfToken, expiresAt: new Date(expiresAt).toISOString() } };
}

export function createAuthRouter(config: Config, database: Database, sessions: SessionInfrastructure) {
  const router = Router();
  const origin = requireOrigin(config.origin);
  const transport = config.secureCookies ? [noStore, requireHttps] : [noStore];
  const authenticate = createOwnerAuthenticator(database.prisma);
  const limitLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    identifier: 'login-per-ip',
    // Express ignores forwarding headers unless the immediate peer is explicitly trusted.
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    handler: (_request, _response, next) => next(new HttpError(429, 'LOGIN_RATE_LIMITED', 'Too many login attempts. Try again later.')),
  });
  const limitTotal = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    keyGenerator: () => 'login',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    identifier: 'login-total',
    handler: (_request, _response, next) => next(new HttpError(429, 'LOGIN_RATE_LIMITED', 'Too many login attempts. Try again later.')),
  });

  router.post('/login', ...transport, origin, limitLogin, limitTotal, sessions.middleware, requireCsrfIfAuthenticated,
    requireJson, parseJson, async (request, response) => {
      parse(emptyObject, request.query, 'query');
      const owner = await authenticate(parse(loginBody, request.body, 'body'));
      if (!owner) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');

      const login: LoginSession = {
        username: owner.username,
        expiresAt: Math.floor(Date.now() / 1000) * 1000 + sessionLifetimeMs,
        csrfToken: randomBytes(32).toString('hex'),
      };

      let signedId: string;
      try {
        await new Promise<void>((resolve, reject) => request.session.regenerate(error => error ? reject(error) : resolve()));
        request.session.login = login;
        request.session.cookie.expires = new Date(login.expiresAt);
        await new Promise<void>((resolve, reject) => request.session.save(error => error ? reject(error) : resolve()));
        signedId = `s:${cookieSignature.sign(request.sessionID, config.sessionSecret)}`;
      } finally {
        // Login is the only session write. Prevent Express from saving it again at response time.
        Reflect.deleteProperty(request, 'session');
      }
      response.cookie(sessions.name, signedId, { ...sessions.cookie, expires: new Date(login.expiresAt) });
      response.json(loginResponse(login));
    });

  router.get('/me', ...transport, sessions.middleware, rejectBody, (request, response) => {
    parse(emptyObject, request.query, 'query');
    const login = activeSession(request);
    if (!login) throw new HttpError(401, 'UNAUTHENTICATED', 'Login is required.');
    response.json(loginResponse(login));
  });

  router.post('/logout', ...transport, origin, sessions.middleware, requireAuthentication, requireCsrf,
    rejectBody, async (request, response) => {
      parse(emptyObject, request.query, 'query');
      await new Promise<void>((resolve, reject) => request.session.destroy(error => error ? reject(error) : resolve()));
      response.clearCookie(sessions.name, sessions.cookie).status(204).end();
    });

  return router;
}
