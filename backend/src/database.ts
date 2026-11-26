import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import type { parseDatabaseUrl } from './config.ts';
import { PrismaClient } from './generated/prisma/client.ts';

export function createDatabase({ url, schema }: ReturnType<typeof parseDatabaseUrl>) {
  const connectionUrl = new URL(url);
  const options = connectionUrl.searchParams.get('options');
  // The Prisma pg adapter expects ISO dates and treats returned TIMESTAMPTZ fields as UTC.
  const dateOptions = '-c datestyle=ISO,YMD -c timezone=UTC';
  connectionUrl.searchParams.set('options', options ? options + ' ' + dateOptions : dateOptions);
  const pool = new pg.Pool({ connectionString: connectionUrl.href, connectionTimeoutMillis: 5_000 });
  pool.on('error', () => console.error('Idle PostgreSQL connection failed.'));
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool, {
      schema,
      onPoolError: () => {}, // The pool listener above owns logging.
      onConnectionError: () => console.error('PostgreSQL connection failed.'),
    }),
  });

  return {
    prisma,
    pool,
    schema,
    async close() {
      try {
        await prisma.$disconnect();
      } finally {
        await pool.end();
      }
    },
  };
}

export type Database = ReturnType<typeof createDatabase>;
