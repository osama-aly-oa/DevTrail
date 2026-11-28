import { defineConfig } from 'prisma/config';
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile();
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node --env-file-if-exists=.env src/seed.ts' },
  datasource: { url: process.env.DATABASE_URL },
});
