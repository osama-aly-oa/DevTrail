import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import * as argon2 from 'argon2';
import cookieSignature from 'cookie-signature';
import pg from 'pg';
import request from 'supertest';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { provisionOwner } from '../src/auth/owner.ts';
import { createSessionInfrastructure, sessionLifetimeMs } from '../src/auth/session.ts';
import { parseDatabaseUrl, readConfig } from '../src/config.ts';
import { createDatabase } from '../src/database.ts';
import type { Database } from '../src/database.ts';
import { todayInIstanbul } from '../src/domain/date.ts';

const base = '/api/v1';
const localOrigin = 'http://localhost:3000';
const sessionSecret = randomBytes(32).toString('hex');
const credentials = { username: 'fixture-owner', password: randomBytes(24).toString('hex') };
const seedEnv = { OWNER_USERNAME: credentials.username, OWNER_PASSWORD: credentials.password };
const replacement = randomBytes(24).toString('hex');
const schema = 'test_' + randomUUID().replaceAll('-', '');
const missingId = '9223372036854775807';

let admin: pg.Pool | undefined;
let schemaCreated = false;
let database: Database;
let config: ReturnType<typeof readConfig>;
let application: ReturnType<typeof createApp>;
let seedResults: string[];
let domainAuth: { cookie: string; csrfToken: string };

function table(name: string) {
  return '"' + schema + '"."' + name + '"';
}

function cookieHeader(response: Response) {
  const cookies = response.headers['set-cookie'] as unknown;
  if (!Array.isArray(cookies) || cookies.length !== 1 || typeof cookies[0] !== 'string') {
    throw new Error('Expected exactly one session cookie.');
  }
  return cookies[0];
}

function sessionId(cookie: string) {
  const encoded = cookie.slice(cookie.indexOf('=') + 1);
  const signed = decodeURIComponent(encoded);
  const id = cookieSignature.unsign(signed.slice(2), sessionSecret);
  if (!id) throw new Error('Expected a signed session cookie.');
  return id;
}

async function login(app = application.app) {
  const response = await request(app).post(base + '/auth/login').set('Origin', localOrigin).send(credentials).expect(200);
  return { cookie: cookieHeader(response).split(';')[0], csrfToken: response.body.data.csrfToken as string, response };
}

function asOwner() {
  return { Cookie: domainAuth.cookie, Origin: localOrigin, 'X-CSRF-Token': domainAuth.csrfToken };
}

async function project(name: string) {
  const response = await request(application.app).post(base + '/projects').set(asOwner()).send({ name }).expect(201);
  return response.body.data.id as string;
}

const draft = { sessionDate: '2024-02-29', workSummary: 'Implemented a small refactor.' };

function migrate(url: URL) {
  const result = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url.href }, encoding: 'utf8', timeout: 30_000,
  });
  if (result.status !== 0) throw new Error('Migrations failed in the PostgreSQL integration schema.');
}

beforeAll(async () => {
  const { url } = parseDatabaseUrl(process.env.TEST_DATABASE_URL);
  if (!/^\/devtrail_test_[a-z0-9_]+$/.test(url.pathname) || url.searchParams.has('schema') || url.searchParams.has('options')) {
    throw new Error('TEST_DATABASE_URL must point to a dedicated devtrail_test_* database without schema or options parameters.');
  }
  if (process.env.DATABASE_URL && parseDatabaseUrl(process.env.DATABASE_URL).url.pathname === url.pathname) {
    throw new Error('Use different database names for DATABASE_URL and TEST_DATABASE_URL.');
  }

  admin = new pg.Pool({ connectionString: url.href, connectionTimeoutMillis: 5_000 });
  const identity = await admin.query<{ name: string }>('SELECT current_database() AS name');
  if ('/' + identity.rows[0].name !== url.pathname) throw new Error('Unexpected integration database.');
  await admin.query('CREATE SCHEMA "' + schema + '"');
  schemaCreated = true;
  url.searchParams.set('schema', schema);

  migrate(url);

  config = readConfig({ APP_ORIGIN: localOrigin, DATABASE_URL: url.href, SESSION_SECRET: sessionSecret, NODE_ENV: 'test' });
  database = createDatabase(config.database);
  seedResults = await Promise.all([
    provisionOwner(database.prisma, seedEnv),
    provisionOwner(database.prisma, seedEnv),
  ]);
  application = createApp(config, database);
  domainAuth = await login();
}, 45_000);

afterAll(async () => {
  try {
    await Promise.all([application?.close(), database?.close()]);
  } finally {
    try {
      // The verified test database and generated schema limit cleanup to this invocation's fixtures.
      if (schemaCreated) await admin?.query('DROP SCHEMA "' + schema + '" CASCADE');
    } finally {
      await admin?.end();
    }
  }
}, 15_000);

describe('PostgreSQL migrations and constraints', () => {
  it('records the clean migration and creates typed columns and identity keys', async () => {
    const result = await database.pool.query('SELECT migration_name, finished_at FROM ' + table('_prisma_migrations'));
    expect(result.rows).toEqual([{ migration_name: '20261126000000_backend_core', finished_at: expect.any(Date) }]);
    const columns = await database.pool.query(
      'SELECT table_name, column_name, data_type, identity_generation FROM information_schema.columns ' +
      "WHERE table_schema = $1 AND table_name <> '_prisma_migrations' " +
      'AND column_name IN ($2, $3, $4) ORDER BY table_name, column_name',
      [schema, 'id', 'sessionDate', 'createdAt'],
    );
    expect(columns.rows).toEqual([
      { table_name: 'development_session', column_name: 'createdAt', data_type: 'timestamp with time zone', identity_generation: null },
      { table_name: 'development_session', column_name: 'id', data_type: 'bigint', identity_generation: 'ALWAYS' },
      { table_name: 'development_session', column_name: 'sessionDate', data_type: 'date', identity_generation: null },
      { table_name: 'owner_account', column_name: 'id', data_type: 'smallint', identity_generation: null },
      { table_name: 'project', column_name: 'createdAt', data_type: 'timestamp with time zone', identity_generation: null },
      { table_name: 'project', column_name: 'id', data_type: 'bigint', identity_generation: 'ALWAYS' },
    ]);
  });

  it('enforces nonblank project names, Unicode lengths, and case-insensitive uniqueness in SQL', async () => {
    const insert = 'INSERT INTO ' + table('project') + ' (name, description) VALUES ($1, $2)';
    await expect(database.pool.query(insert, [null, null])).rejects.toMatchObject({ code: '23502' });
    await expect(database.pool.query(insert, ['\t\u00A0\u2003\uFEFF', null])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(insert, ['🧪'.repeat(121), null])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(insert, ['description-limit', '🧪'.repeat(2001)])).rejects.toMatchObject({ code: '23514' });
    await database.pool.query(insert, ['🧪'.repeat(120), '🧪'.repeat(2000)]);
    await database.pool.query(insert, ['Écho SQL', null]);
    await expect(database.pool.query(insert, ['E\u0301CHO SQL', null])).rejects.toMatchObject({
      code: '23505', constraint: 'project_name_ci_key',
    });
    await database.pool.query(insert, ['Echo SQL', null]);
  });

  it('enforces foreign keys, restricted deletion, text lengths, and the Istanbul date on insert and update', async () => {
    const projectId = await project('SQL constraints');
    const insert = 'INSERT INTO ' + table('development_session') +
      ' ("projectId", "sessionDate", "workSummary", "workFocus") VALUES ($1, $2, $3, $4) RETURNING id';
    await expect(database.pool.query(insert, [missingId, draft.sessionDate, 'notes', null])).rejects.toMatchObject({ code: '23503' });
    await expect(database.pool.query(insert, [projectId, draft.sessionDate, null, null])).rejects.toMatchObject({ code: '23502' });
    await expect(database.pool.query(insert, [projectId, draft.sessionDate, '\t\u00A0', null])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(insert, [projectId, draft.sessionDate, '🧪'.repeat(5001), null])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(insert, [projectId, draft.sessionDate, 'notes', '🧪'.repeat(241)])).rejects.toMatchObject({ code: '23514' });
    await expect(database.pool.query(insert, [projectId, '0001-01-01 BC', 'notes', null])).rejects.toMatchObject({ code: '23514' });

    const connection = await database.pool.connect();
    try {
      await connection.query("SET TIME ZONE 'Pacific/Honolulu'");
      const result = await connection.query<{ today: string; tomorrow: string }>(
        "SELECT ((clock_timestamp() AT TIME ZONE 'Europe/Istanbul')::date)::text AS today, " +
        "((clock_timestamp() AT TIME ZONE 'Europe/Istanbul')::date + 1)::text AS tomorrow",
      );
      const { today, tomorrow } = result.rows[0];
      expect(today).toBe(todayInIstanbul());
      const row = await connection.query(insert, [projectId, today, '🧪'.repeat(5000), '🧪'.repeat(240)]);
      const sessionId = row.rows[0].id;
      await expect(connection.query(insert, [projectId, tomorrow, 'notes', null])).rejects.toMatchObject({
        code: '23514', constraint: 'development_session_future_date_check',
      });
      await expect(connection.query(
        'UPDATE ' + table('development_session') + ' SET "sessionDate" = $1 WHERE id = $2', [tomorrow, sessionId],
      )).rejects.toMatchObject({ code: '23514', constraint: 'development_session_future_date_check' });
      for (const column of ['learningNotes', 'difficulties', 'nextSteps']) {
        await expect(connection.query(
          'UPDATE ' + table('development_session') + ' SET "' + column + '" = $1 WHERE id = $2', ['🧪'.repeat(5001), sessionId],
        )).rejects.toMatchObject({ code: '23514' });
      }
    } finally {
      try {
        await connection.query('RESET TIME ZONE');
      } finally {
        connection.release();
      }
    }
    await expect(database.pool.query('DELETE FROM ' + table('project') + ' WHERE id = $1', [projectId]))
      .rejects.toMatchObject({ code: '23001', constraint: 'development_session_projectId_fkey' });
  });

  it.each(['insert', 'delete'] as const)('preserves the relationship when a concurrent %s obtains the lock first', async first => {
    const id = await project('Race SQL ' + first);
    const insert = 'INSERT INTO ' + table('development_session') +
      ' ("projectId", "sessionDate", "workSummary") VALUES ($1, $2, $3)';
    const remove = 'DELETE FROM ' + table('project') + ' WHERE id = $1';
    const winner = await database.pool.connect();
    const contender = await database.pool.connect();
    try {
      await winner.query('BEGIN');
      await contender.query("SET lock_timeout = '3s'");
      if (first === 'insert') await winner.query(insert, [id, draft.sessionDate, 'First']);
      else await winner.query(remove, [id]);
      const competingQuery = first === 'insert' ? contender.query(remove, [id]) : contender.query(insert, [id, draft.sessionDate, 'Second']);
      const outcome = competingQuery.catch((error: unknown) => error);
      await winner.query('COMMIT');
      expect(await outcome).toMatchObject({
        code: first === 'insert' ? '23001' : '23503', constraint: 'development_session_projectId_fkey',
      });
    } finally {
      try {
        await Promise.all([winner.query('ROLLBACK'), contender.query('RESET lock_timeout')]);
      } finally {
        winner.release();
        contender.release();
      }
    }
  });

  it('provisions one Argon2id owner concurrently and never changes the password on rerun', async () => {
    expect(seedResults.sort()).toEqual(['Existing owner retained. Password unchanged.', 'Owner provisioned.']);
    const owner = await database.prisma.owner.findUniqueOrThrow({ where: { id: 1 } });
    expect(owner.passwordHash).toMatch(/^\$argon2id\$/);
    expect(owner.passwordHash).not.toContain(credentials.password);
    expect(await argon2.verify(owner.passwordHash, credentials.password)).toBe(true);
    await expect(provisionOwner(database.prisma, { ...seedEnv, OWNER_PASSWORD: replacement }))
      .resolves.toBe('Existing owner retained. Password unchanged.');
    await expect(provisionOwner(database.prisma, {})).rejects.toThrow(/^Set a valid OWNER_USERNAME/);
    await expect(provisionOwner(database.prisma, { ...seedEnv, OWNER_PASSWORD: 'short' })).rejects.toThrow(/^Set a valid OWNER_USERNAME/);
    await expect(provisionOwner(database.prisma, { ...seedEnv, OWNER_USERNAME: 'different' })).rejects.toThrow(/differs/);
    expect(await database.prisma.owner.findMany()).toEqual([owner]);
    await expect(database.pool.query(
      'INSERT INTO ' + table('owner_account') + ' (id, username, "passwordHash") VALUES (2, $1, $2)',
      [owner.username, owner.passwordHash],
    )).rejects.toMatchObject({ code: '23514', constraint: 'owner_singleton_check' });
  });
});

describe('owner authentication', () => {
  it('retains migrations, the owner and an active session after deployment and restart', async () => {
    const firstDatabase = createDatabase(config.database);
    const firstApp = createApp(config, firstDatabase);
    let initial: Awaited<ReturnType<typeof login>>;
    try {
      initial = await login(firstApp.app);
    } finally {
      try {
        await firstApp.close();
      } finally {
        await firstDatabase.close();
      }
    }

    migrate(config.database.url);
    const { cookie, response } = initial;
    const reopenedDatabase = createDatabase(config.database);
    const reopened = createApp(config, reopenedDatabase);
    try {
      await request(reopened.app).get(base + '/auth/me').set('Cookie', cookie).expect(200, response.body);
      await login(reopened.app);
    } finally {
      try {
        await reopened.close();
      } finally {
        await reopenedDatabase.close();
      }
    }
  }, 35_000);
  it('protects product routes and returns the same generic error for an invalid username or password', async () => {
    for (const path of ['/auth/me', '/projects', '/sessions']) {
      await request(application.app).get(base + path).expect(401).expect('Cache-Control', 'no-store');
    }
    const expected = { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } };
    for (const input of [{ ...credentials, username: 'unknown' }, { ...credentials, password: replacement }]) {
      const response = await request(application.app).post(base + '/auth/login').set('Origin', localOrigin).send(input).expect(401, expected);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('delivers only public owner data, a CSRF token, and a fixed clock deadline, with a host-only cookie', async () => {
    const before = Math.floor(Date.now() / 1000) * 1000;
    const { cookie, response } = await login();
    const { data } = response.body;
    expect(data).toEqual({ owner: { username: credentials.username }, csrfToken: expect.stringMatching(/^[a-f0-9]{64}$/), expiresAt: expect.any(String) });
    const expiration = Date.parse(data.expiresAt);
    expect(expiration).toBeGreaterThanOrEqual(before + sessionLifetimeMs);
    expect(expiration).toBeLessThanOrEqual(Date.now() + sessionLifetimeMs);
    const setCookie = cookieHeader(response);
    expect(setCookie).toMatch(/^devtrail\.sid=/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Expires=' + new Date(expiration).toUTCString());
    expect(setCookie).not.toMatch(/Domain=|;\s*Secure\b/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).not.toContain(sessionId(cookie));
    expect(response.text).not.toContain(credentials.password);
    await request(application.app).get(base + '/auth/me').set('Cookie', cookie).expect(200, { data });
  });

  it('enforces matching Origin with a Referer fallback and session-bound CSRF for all authenticated writes', async () => {
    const { cookie, csrfToken } = await login();
    const loginPath = base + '/auth/login';
    await request(application.app).post(loginPath).send(credentials).expect(403);
    await request(application.app).post(loginPath).set({ Origin: 'null', Referer: localOrigin + '/login' }).send(credentials).expect(403);
    await request(application.app).post(loginPath).set('Referer', localOrigin + '/login').send(credentials).expect(200);
    await request(application.app).post(loginPath).set({ Origin: localOrigin, Cookie: cookie }).send(credentials).expect(403);
    const write = () => request(application.app).post(base + '/projects').set({ Origin: localOrigin, Cookie: cookie }).send({ name: 'CSRF fixture' });
    await write().expect(403);
    await write().set('X-CSRF-Token', 'a'.repeat(64)).expect(403);
    await write().set('X-CSRF-Token', domainAuth.csrfToken).expect(403);
    await write().set('X-CSRF-Token', csrfToken).set('Origin', 'http://foreign.example').expect(403);
    await write().set('X-CSRF-Token', csrfToken).expect(201);
  });

  it('regenerates the session ID on login, rejects replay, and destroys the row on logout', async () => {
    const isolated = createApp(config, database);
    try {
      const first = await login(isolated.app);
      const next = await request(isolated.app).post(base + '/auth/login')
        .set({ Cookie: first.cookie, Origin: localOrigin, 'X-CSRF-Token': first.csrfToken }).send(credentials).expect(200);
      const cookie = cookieHeader(next).split(';')[0];
      expect(sessionId(cookie)).not.toBe(sessionId(first.cookie));
      const readCookie = (value: string) => request(isolated.app).get(base + '/auth/me').set('Cookie', value);
      await readCookie(first.cookie).expect(401);
      await readCookie(cookie).expect(200);
      const logout = () => request(isolated.app).post(base + '/auth/logout').set({ Cookie: cookie, Origin: localOrigin });
      await logout().expect(403);
      await logout().set('X-CSRF-Token', first.csrfToken).expect(403);
      const response = await logout().set('X-CSRF-Token', next.body.data.csrfToken).expect(204);
      expect(cookieHeader(response)).toContain('Expires=Thu, 01 Jan 1970');
      await readCookie(cookie).expect(401);
      expect(await database.prisma.httpSession.findUnique({ where: { sid: sessionId(cookie) } })).toBeNull();
    } finally {
      await isolated.close();
    }
  });

  it('does not extend expiration on reads or writes and rejects the cookie at the server deadline', async () => {
    const isolated = createApp(config, database);
    try {
      const { cookie, csrfToken, response } = await login(isolated.app);
      const sid = sessionId(cookie);
      const expiry = Date.parse(response.body.data.expiresAt);
      const stored = () => database.prisma.httpSession.findUniqueOrThrow({ where: { sid } });
      expect((await stored()).expire.valueOf()).toBe(expiry);
      const clock = vi.spyOn(Date, 'now').mockReturnValue(expiry - 1000);
      try {
        const check = await request(isolated.app).get(base + '/auth/me').set('Cookie', cookie).expect(200);
        expect(check.headers['set-cookie']).toBeUndefined();
        const write = await request(isolated.app).post(base + '/projects')
          .set({ Origin: localOrigin, Cookie: cookie, 'X-CSRF-Token': csrfToken }).send({ name: 'Fixed deadline fixture' }).expect(201);
        expect(write.headers['set-cookie']).toBeUndefined();
        expect((await stored()).expire.valueOf()).toBe(expiry);
        clock.mockReturnValue(expiry);
        await request(isolated.app).get(base + '/auth/me').set('Cookie', cookie).expect(401);
        clock.mockReturnValue(expiry + 1000);
        await request(isolated.app).get(base + '/projects').set('Cookie', cookie).expect(401);
      } finally {
        clock.mockRestore();
      }
    } finally {
      await isolated.close();
    }
  });

  it('prunes expired rows without removing active sessions', async () => {
    const { cookie } = await login();
    const sid = sessionId(cookie);
    await database.prisma.httpSession.update({ where: { sid }, data: { expire: new Date(0) } });
    const { store } = createSessionInfrastructure(config, database);
    try {
      await new Promise<void>((resolve, reject) => store.pruneSessions(error => error ? reject(error) : resolve()));
      expect(await database.prisma.httpSession.findUnique({ where: { sid } })).toBeNull();
      await request(application.app).get(base + '/auth/me').set('Cookie', domainAuth.cookie).expect(200);
    } finally {
      await store.close();
    }
  });

  it('requires HTTPS with Secure cookies and ignores TLS forwarding from an untrusted peer', async () => {
    const origin = 'https://devtrail.example';
    const secure = createApp({ ...config, origin, secureCookies: true }, database);
    const proxy = createApp({ ...config, origin, secureCookies: true, trustedProxies: ['127.0.0.1', '::1'] }, database);
    try {
      const headers = { Origin: origin, 'X-Forwarded-Proto': 'https' };
      await request(secure.app).post(base + '/auth/login').set(headers).send(credentials).expect(403);
      await request(proxy.app).post(base + '/auth/login').set('Origin', origin).send(credentials).expect(403);
      const response = await request(proxy.app).post(base + '/auth/login').set(headers).send(credentials).expect(200);
      const cookie = cookieHeader(response);
      expect(cookie).toMatch(/^__Host-devtrail\.sid=/);
      expect(cookie).toContain('; Secure');
      expect(cookie).toContain('; HttpOnly');
      expect(cookie).toContain('; SameSite=Lax');
      expect(cookie).not.toContain('Domain=');
      await request(proxy.app).get(base + '/auth/me').set({ ...headers, Cookie: cookie.split(';')[0] }).expect(200);
      await request(secure.app).get(base + '/health').expect(200, { status: 'ok' });
    } finally {
      await Promise.all([secure.close(), proxy.close()]);
    }
  });

  it('rate-limits credential guessing even with spoofed forwarding addresses', async () => {
    const isolated = createApp(config, database);
    try {
      for (let attempt = 1; attempt <= 10; attempt++) {
        await request(isolated.app).post(base + '/auth/login')
          .set({ Origin: localOrigin, 'X-Forwarded-For': '192.0.2.' + attempt })
          .send({ ...credentials, password: replacement }).expect(401);
      }
      const response = await request(isolated.app).post(base + '/auth/login').set('Origin', localOrigin).send(credentials).expect(429);
      expect(response.body.error.code).toBe('LOGIN_RATE_LIMITED');
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    } finally {
      await isolated.close();
    }
  });

  it('redacts malformed credential bodies and database failures from responses and logs', async () => {
    const isolated = createApp(config, { ...database, schema: schema + '_missing' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const badBody = await request(isolated.app).post(base + '/auth/login').set('Origin', localOrigin)
        .set('Content-Type', 'application/json').send('{"password":"' + credentials.password + '",').expect(400);
      expect(badBody.text).not.toContain(credentials.password);
      const failure = await request(isolated.app).get(base + '/auth/me').set('Cookie', domainAuth.cookie).expect(500, {
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
      });
      expect(failure.text).not.toContain(schema);
      expect(failure.text).not.toContain(domainAuth.csrfToken);
      expect(log).toHaveBeenCalledExactlyOnceWith('Unhandled request error.');
    } finally {
      log.mockRestore();
      await isolated.close();
    }
  });
});

describe('Projects API', () => {
  it('creates, retrieves, partially updates, clears optional text, and deletes a project', async () => {
    const created = await request(application.app).post(base + '/projects').set(asOwner())
      .send({ name: '  API CRUD  ', description: '\u2003' }).expect(201);
    const { data } = created.body;
    const path = base + '/projects/' + data.id;
    expect(created.headers.location).toBe(path);
    expect(data).toEqual({
      id: expect.stringMatching(/^[1-9]\d*$/), name: 'API CRUD', description: null,
      createdAt: expect.any(String), updatedAt: expect.any(String),
    });
    await request(application.app).get(path).set(asOwner()).expect(200, { data });
    const updated = await request(application.app).patch(path).set(asOwner()).send({ description: ' A description ' }).expect(200);
    expect(updated.body.data).toMatchObject({ name: data.name, description: 'A description', createdAt: data.createdAt });
    expect(Date.parse(updated.body.data.updatedAt)).toBeGreaterThan(Date.parse(data.updatedAt));
    const cleared = await request(application.app).patch(path).set(asOwner()).send({ description: null }).expect(200);
    expect(cleared.body.data.description).toBeNull();
    await request(application.app).delete(path).set(asOwner()).expect(204);
    await request(application.app).get(path).set(asOwner()).expect(404);
    await request(application.app).patch(path).set(asOwner()).send({ name: 'Missing' }).expect(404);
    await request(application.app).delete(path).set(asOwner()).expect(404);
  });

  it('validates payloads, canonical IDs, queries, content type, and Unicode code points', async () => {
    const write = () => request(application.app).post(base + '/projects').set(asOwner());
    for (const body of [{}, { name: 2 }, { name: ' \t\u2003' }, { name: 'a', createdAt: 0 }, { name: '📚'.repeat(121) },
      { name: 'a', description: '📚'.repeat(2001) }, { name: 'a\ud800' }, { name: 'a\u0000' }, ['a']]) {
      await write().send(body).expect(400);
    }
    await write().send({ name: '📚'.repeat(120), description: '📚'.repeat(2000) }).expect(201);
    await write().set('Content-Type', 'text/plain').send('text').expect(415);
    await write().send({ name: 'Oversize', description: 'a'.repeat(280_000) }).expect(413);
    for (const suffix of ['/0', '/01', '/-1', '/1.0', '/9223372036854775808', '/%zz',
      '?limit=101', '?limit=1&limit=2', '?limit[x]=1', '?offset=-1', '?offset=2147483648', '?unknown=1']) {
      await request(application.app).get(base + '/projects' + suffix).set(asOwner()).expect(400);
    }
    const id = await project('Strict PATCH');
    const path = base + '/projects/' + id;
    await request(application.app).patch(path).set(asOwner()).send({}).expect(400);
    await request(application.app).patch(path).set(asOwner()).send({ name: null }).expect(400);
    await request(application.app).get(path + '?limit=1').set(asOwner()).expect(400);
    await request(application.app).delete(path).set(asOwner()).send({ extra: true }).expect(400);
    await request(application.app).get(base + '/projects/' + missingId).set(asOwner()).expect(404);
  });

  it('returns 409 for case-insensitive collisions on concurrent create and on update', async () => {
    const make = (name: string) => request(application.app).post(base + '/projects').set(asOwner()).send({ name });
    const responses = await Promise.all([make('API RACE'), make('api race'), make('Api Race')]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409, 409]);
    for (const response of responses.filter(response => response.status === 409)) {
      expect(response.body.error.code).toBe('PROJECT_NAME_TAKEN');
    }
    const id = await project('Name before update');
    const response = await request(application.app).patch(base + '/projects/' + id).set(asOwner())
      .send({ name: 'API race' }).expect(409);
    expect(response.body.error.code).toBe('PROJECT_NAME_TAKEN');
  });

  it('pages projects by creation time with descending ID as a tie-breaker', async () => {
    const ordered = await database.pool.query(
      'INSERT INTO ' + table('project') + ' (name, "createdAt") VALUES ' +
      "('project tie first', '2090-01-02'), ('project tie second', '2090-01-02'), ('project older', '2090-01-01') RETURNING id",
    );
    const [first, second, older] = ordered.rows.map(row => row.id);
    const list = (query = '') => request(application.app).get(base + '/projects' + query).set(asOwner()).expect(200);
    const page = await list('?offset=0&limit=2');
    expect(page.body.data.map((row: { id: string }) => row.id)).toEqual([second, first]);
    expect(page.body.pagination).toEqual({ offset: 0, limit: 2, hasMore: true });
    const next = await list('?offset=2&limit=1');
    expect(next.body.data[0].id).toBe(older);
    expect((await list()).body.pagination).toMatchObject({ offset: 0, limit: 20 });
    expect((await list('?offset=2147483647&limit=100')).body).toEqual({
      data: [], pagination: { offset: 2147483647, limit: 100, hasMore: false },
    });
  });

  it('protects project deletion under a concurrent development session write', async () => {
    const id = await project('Delete/create race API');
    const [remove, create] = await Promise.all([
      request(application.app).delete(base + '/projects/' + id).set(asOwner()),
      request(application.app).post(base + '/sessions').set(asOwner()).send({ ...draft, projectId: id }),
    ]);
    expect([[204, 404], [409, 201]]).toContainEqual([remove.status, create.status]);
    const sessions = await database.prisma.developmentSession.findMany({ where: { projectId: BigInt(id) } });
    expect(sessions).toHaveLength(remove.status === 204 ? 0 : 1);
    if (remove.status === 409) expect(remove.body.error.code).toBe('PROJECT_HAS_SESSIONS');
    else expect(create.body.error).toEqual({ code: 'NOT_FOUND', message: 'Project not found.' });
  });
});

describe('Development Sessions API', () => {
  it('creates, reads, reassigns, updates, and deletes a session with nullable text', async () => {
    const source = await project('Session CRUD source');
    const destination = await project('Session CRUD destination');
    const created = await request(application.app).post(base + '/sessions').set(asOwner()).send({
      ...draft, projectId: source, workFocus: ' focus ', learningNotes: '\t', difficulties: null,
    }).expect(201);
    const { data } = created.body;
    const path = base + '/sessions/' + data.id;
    expect(created.headers.location).toBe(path);
    expect(data).toEqual({
      ...draft, id: expect.stringMatching(/^[1-9]\d*$/), projectId: source, workFocus: 'focus',
      learningNotes: null, difficulties: null, nextSteps: null, createdAt: expect.any(String), updatedAt: expect.any(String),
    });
    const restriction = await request(application.app).delete(base + '/projects/' + source).set(asOwner()).expect(409);
    expect(restriction.body.error.code).toBe('PROJECT_HAS_SESSIONS');
    await request(application.app).get(path).set(asOwner()).expect(200, { data });
    const updated = await request(application.app).patch(path).set(asOwner()).send({
      projectId: destination, workFocus: null, nextSteps: '  Follow up  ', sessionDate: '2024-03-01',
    }).expect(200);
    expect(updated.body.data).toMatchObject({
      projectId: destination, workFocus: null, nextSteps: 'Follow up', sessionDate: '2024-03-01', workSummary: draft.workSummary,
    });
    await request(application.app).delete(base + '/projects/' + source).set(asOwner()).expect(204);
    await request(application.app).delete(base + '/projects/' + destination).set(asOwner()).expect(409);
    await request(application.app).delete(path).set(asOwner()).expect(204);
    await request(application.app).get(path).set(asOwner()).expect(404);
    await request(application.app).patch(path).set(asOwner()).send({ workFocus: null }).expect(404);
    await request(application.app).delete(path).set(asOwner()).expect(404);
    await request(application.app).delete(base + '/projects/' + destination).set(asOwner()).expect(204);
  });

  it('validates new and patched dates, project relationships, and text', async () => {
    const projectId = await project('Session validation');
    const create = (body: object) => request(application.app).post(base + '/sessions').set(asOwner()).send(body);
    for (const fields of [{ projectId: Number(projectId) }, { projectId: '01' }, { sessionDate: '2024-02-30' },
      { sessionDate: '2024-02-29T00:00:00Z' }, { sessionDate: '0000-01-01' }, { workSummary: '\u00A0' },
      { workSummary: null }, { workSummary: '🐢'.repeat(5001) }, { workFocus: '🐢'.repeat(241) }, { unknown: true }]) {
      await create({ ...draft, projectId, ...fields }).expect(400);
    }
    const future = await create({ ...draft, projectId, sessionDate: '9999-01-01' }).expect(400);
    expect(future.body.error.message).toBe('Session date cannot be in the future.');
    await create({ ...draft, projectId: missingId }).expect(404);

    const today = todayInIstanbul();
    const created = await create({ ...draft, projectId, sessionDate: today, workSummary: '🐢'.repeat(5000) }).expect(201);
    expect(created.body.data.sessionDate).toBe(today);
    const path = base + '/sessions/' + created.body.data.id;
    const patch = (body: object) => request(application.app).patch(path).set(asOwner()).send(body);
    await patch({}).expect(400);
    await patch({ workSummary: ' ' }).expect(400);
    await patch({ projectId: missingId }).expect(404);
    await patch({ sessionDate: '9999-01-01' }).expect(400);
    expect((await request(application.app).get(path).set(asOwner()).expect(200)).body.data).toMatchObject({ projectId, sessionDate: today });
  });

  it('changes the API date at Istanbul midnight and maps the database date guard safely', async () => {
    const projectId = await project('Istanbul boundary');
    const create = (sessionDate: string) => request(application.app).post(base + '/sessions')
      .set(asOwner()).send({ ...draft, projectId, sessionDate });

    const tomorrow = new Date(Date.parse(todayInIstanbul()) + 86_400_000).toISOString().slice(0, 10);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2025-02-11T20:59:59.999Z'));
      await create('2025-02-12').expect(400);
      vi.setSystemTime(new Date('2025-02-11T21:00:00.000Z'));
      const original = await create('2025-02-12').expect(201);
      const path = base + '/sessions/' + original.body.data.id;
      vi.setSystemTime(new Date(tomorrow + 'T12:00:00Z'));
      const expected = {
        error: { code: 'CONSTRAINT_VIOLATION', message: 'The data does not satisfy a database constraint.' },
      };
      await create(tomorrow).expect(400, expected);
      await request(application.app).patch(path).set(asOwner())
        .send({ sessionDate: tomorrow, workSummary: 'Rejected change' }).expect(400, expected);
      await request(application.app).get(path).set(asOwner()).expect(200, original.body);
      expect(await database.prisma.developmentSession.count({ where: { projectId: BigInt(projectId) } })).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('filters by project and inclusive dates and uses all three ordering keys across pages', async () => {
    const projectId = await project('Session list filter');
    const otherProject = await project('Other list project');
    const created = await database.pool.query(
      'INSERT INTO ' + table('development_session') +
      ' ("projectId", "sessionDate", "createdAt", "workSummary") VALUES ' +
      "($1, '2023-04-01', '2023-04-03T10:00:00Z', 'First date'), " +
      "($1, '2023-04-02', '2023-04-02T10:00:00Z', 'First created'), " +
      "($1, '2023-04-02', '2023-04-02T11:00:00Z', 'Second created'), " +
      "($1, '2023-04-02', '2023-04-02T11:00:00Z', 'Higher ID'), " +
      "($2, '2023-04-02', '2023-04-02T12:00:00Z', 'Other project') RETURNING id",
      [projectId, otherProject],
    );
    const [firstDate, firstCreated, secondCreated, higherId, other] = created.rows.map(row => row.id);
    const list = (query: string) => request(application.app).get(base + '/sessions?' + query).set(asOwner()).expect(200);
    const ids = (response: Response) => response.body.data.map((row: { id: string }) => row.id);
    const query = 'projectId=' + projectId + '&from=2023-04-01&to=2023-04-02';
    const first = await list(query + '&limit=2');
    expect(ids(first)).toEqual([higherId, secondCreated]);
    expect(first.body.pagination).toEqual({ offset: 0, limit: 2, hasMore: true });
    const second = await list(query + '&offset=2&limit=2');
    expect(ids(second)).toEqual([firstCreated, firstDate]);
    expect(second.body.pagination).toEqual({ offset: 2, limit: 2, hasMore: false });
    const sameDate = await list('from=2023-04-02&to=2023-04-02');
    expect(ids(sameDate)).toEqual([other, higherId, secondCreated, firstCreated]);
    expect(sameDate.body.data.every((row: { sessionDate: string }) => row.sessionDate === '2023-04-02')).toBe(true);
    expect(ids(await list('projectId=' + projectId + '&from=2023-04-02'))).toEqual([higherId, secondCreated, firstCreated]);
    expect(ids(await list('projectId=' + projectId + '&to=2023-04-01'))).toEqual([firstDate]);
    expect(ids(await list('projectId=' + missingId))).toEqual([]);
    for (const invalid of ['from=2024-04-01&to=2024-03-01', 'projectId=+1', 'to=2024-02-30', 'from=2024-01-01&from=2024-01-02']) {
      await request(application.app).get(base + '/sessions?' + invalid).set(asOwner()).expect(400);
    }
  });

  it('reads and writes IDs beyond JavaScript safe integers without truncation', async () => {
    const projectId = '9007199254740993';
    const sessionId = '9007199254740995';
    await database.pool.query(
      'INSERT INTO ' + table('project') + ' (id, name) OVERRIDING SYSTEM VALUE VALUES ($1, $2)', [projectId, 'Large ID fixture'],
    );
    await database.pool.query(
      'INSERT INTO ' + table('development_session') + ' (id, "projectId", "sessionDate", "workSummary") ' +
      "OVERRIDING SYSTEM VALUE VALUES ($1, $2, '2024-01-02', 'Large ID')", [sessionId, projectId],
    );
    const result = await request(application.app).get(base + '/projects/' + projectId).set(asOwner()).expect(200);
    expect(result.body.data.id).toBe(projectId);
    const response = await request(application.app).patch(base + '/sessions/' + sessionId).set(asOwner()).send({ projectId }).expect(200);
    expect(response.body.data).toMatchObject({ id: sessionId, projectId });
    const filtered = await request(application.app).get(base + '/sessions?projectId=' + projectId).set(asOwner()).expect(200);
    expect(filtered.body.data.map((row: { id: string }) => row.id)).toEqual([sessionId]);
  });
});
