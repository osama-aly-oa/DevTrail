import { isIP } from 'node:net';

export function parseDatabaseUrl(value: string | undefined) {
  let url: URL;
  try {
    url = new URL(value ?? '');
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2 || url.hash) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
  const schema = url.searchParams.get('schema') ?? 'public';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) {
    throw new Error('DATABASE_URL schema must be a lowercase PostgreSQL identifier.');
  }
  return { url, schema };
}

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const configuredPort = env.PORT ?? '3000';
  const port = Number(configuredPort);
  if (!/^\d+$/.test(configuredPort) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT. Set PORT to a whole number from 1 to 65535.');
  }

  const database = parseDatabaseUrl(env.DATABASE_URL);
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret || !/^[a-f0-9]{64}$/i.test(sessionSecret)) {
    throw new Error('SESSION_SECRET must be a 32-byte secret encoded as 64 hexadecimal characters.');
  }

  let origin: URL;
  try {
    origin = new URL(env.APP_ORIGIN ?? '');
  } catch {
    throw new Error('APP_ORIGIN must be the canonical browser origin.');
  }
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  const secureCookies = origin.protocol === 'https:';
  const localHttp = origin.protocol === 'http:' && isLoopback &&
    [undefined, 'development', 'test'].includes(env.NODE_ENV);
  if (env.APP_ORIGIN !== origin.origin || (!secureCookies && !localHttp)) {
    throw new Error('APP_ORIGIN must be an HTTPS origin. HTTP is available for local loopback development.');
  }

  const trustedProxies = env.TRUSTED_PROXY_IPS?.split(',').map(ip => ip.trim()) ?? [];
  if (trustedProxies.some(ip => isIP(ip) === 0)) {
    throw new Error('TRUSTED_PROXY_IPS must contain a comma-separated list of IP addresses.');
  }

  return { port, database, sessionSecret, origin: origin.origin, secureCookies, trustedProxies };
}

export type Config = ReturnType<typeof readConfig>;
