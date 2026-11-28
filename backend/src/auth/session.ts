import pgSession from 'connect-pg-simple';
import session from 'express-session';
import type { CookieOptions } from 'express';
import type { Config } from '../config.ts';
import type { Database } from '../database.ts';

export const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export interface LoginSession {
  username: string;
  expiresAt: number;
  csrfToken: string;
}

declare module 'express-session' {
  interface SessionData {
    login?: LoginSession;
  }
}

export function createSessionInfrastructure(config: Config, database: Database) {
  const name = config.secureCookies ? '__Host-devtrail.sid' : 'devtrail.sid';
  const cookie = { httpOnly: true, secure: config.secureCookies, sameSite: 'lax', path: '/' } satisfies CookieOptions;
  const Store = pgSession(session);
  const store = new Store({
    pool: database.pool,
    schemaName: database.schema,
    tableName: 'http_session',
    createTableIfMissing: false,
    disableTouch: true,
    pruneSessionInterval: 900,
    errorLog: () => console.error('PostgreSQL session maintenance failed.'),
  });
  const middleware = session({
    name,
    secret: config.sessionSecret,
    store,
    cookie,
    rolling: false,
    resave: false,
    saveUninitialized: false,
    unset: 'keep',
  });
  return { name, cookie, middleware, store };
}

export type SessionInfrastructure = ReturnType<typeof createSessionInfrastructure>;
