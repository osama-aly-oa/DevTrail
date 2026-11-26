import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { createDatabase } from './database.ts';

function loadConfig() {
  try {
    return readConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid backend configuration.');
    process.exit(1);
  }
}

const config = loadConfig();
const database = createDatabase(config.database);
const application = createApp(config, database);
const host = config.secureCookies ? '::' : new URL(config.origin).hostname === '[::1]' ? '::1' : '127.0.0.1';

async function closeResources() {
  try {
    await application.close();
  } finally {
    await database.close();
  }
}

try {
  await database.pool.query('SELECT 1');
  const server = application.app.listen(config.port, host, error => {
    if (error) {
      console.error('DevTrail API could not start listening.');
      void closeResources().finally(() => process.exit(1));
      return;
    }
    console.log('DevTrail API listening on port ' + config.port);
  });
  const shutdown = () => {
    server.close(() => {
      void closeResources().catch(() => {
        console.error('DevTrail API shutdown failed.');
        process.exitCode = 1;
      });
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  console.error('DevTrail API could not connect to PostgreSQL.');
  await closeResources();
  process.exitCode = 1;
}
