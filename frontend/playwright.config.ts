import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const database = process.env.E2E_DATABASE_URL;
const owner = process.env.E2E_OWNER_USERNAME;
const password = process.env.E2E_OWNER_PASSWORD;
const origin = 'http://127.0.0.1:5174';
const apiPort = '3102';

if (!database || !/^\/devtrail_test_[a-z0-9_]+$/.test(new URL(database).pathname) || !owner || !password) {
  throw new Error('Set E2E_DATABASE_URL to a disposable devtrail_test_* database and supply fixture owner credentials.');
}

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 45_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: origin,
    launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH },
    timezoneId: 'America/Los_Angeles',
  },
  webServer: [
    {
      command: 'npm --prefix ../backend start',
      url: 'http://127.0.0.1:' + apiPort + '/api/v1/health',
      env: {
        APP_ORIGIN: origin,
        NODE_ENV: 'test',
        PORT: apiPort,
        DATABASE_URL: database,
        SESSION_SECRET: randomBytes(32).toString('hex'),
      },
    },
    {
      command: 'npm run preview -- --port 5174',
      url: origin,
      env: { DEVTRAIL_API_PORT: apiPort },
    },
  ],
});
