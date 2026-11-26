import { parseDatabaseUrl } from './config.ts';
import { createDatabase } from './database.ts';
import { ProvisionError, provisionOwner } from './auth/owner.ts';

try {
  const database = createDatabase(parseDatabaseUrl(process.env.DATABASE_URL));
  try {
    console.log(await provisionOwner(database.prisma, process.env));
  } finally {
    await database.close();
  }
} catch (error) {
  console.error(error instanceof ProvisionError ? error.message : 'Owner provisioning failed. Check the database configuration and migrations.');
  process.exitCode = 1;
}
