import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const database = process.env.E2E_DATABASE_URL;
const owner = process.env.E2E_OWNER_USERNAME;
const password = process.env.E2E_OWNER_PASSWORD;
const browserPort = process.env.E2E_BROWSER_PORT ?? '5174';
const apiPort = process.env.E2E_API_PORT ?? '3102';
const origin = 'http://127.0.0.1:' + browserPort;

if (![browserPort, apiPort].every(port => /^[1-9]\d{0,4}$/.test(port) && Number(port) <= 65_535) || browserPort === apiPort) {
  throw new Error('Choose distinct valid E2E_BROWSER_PORT and E2E_API_PORT values.');
}

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
      command: 'npm run preview -- --port ' + browserPort,
      url: origin,
      env: { DEVTRAIL_API_PORT: apiPort },
    },
  ],
});
