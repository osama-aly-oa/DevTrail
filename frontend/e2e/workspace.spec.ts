import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

const api = '/api/v1';
const fixtureOwner = process.env.E2E_OWNER_USERNAME!;
const fixturePassword = process.env.E2E_OWNER_PASSWORD!;
let ownerCookies: Awaited<ReturnType<BrowserContext['cookies']>>;

test.beforeAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  try {
    const response = await context.request.post(api + '/auth/login', {
      headers: { Origin: baseURL ?? '' }, data: { username: fixtureOwner, password: fixturePassword },
    });
    expect(response.status()).toBe(200);
    ownerCookies = await context.cookies();
  } finally {
    await context.close();
  }
});

async function signIn(page: Page, path = '/timeline') {
  await page.context().addCookies(ownerCookies);
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Open global search and command palette' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(path.split('?')[0] + '(?:\\?|$)'));
}

async function ownerHeaders(page: Page) {
  const response = await page.request.get(api + '/auth/me');
  expect(response.ok()).toBe(true);
  const { data } = await response.json() as { data: { csrfToken: string } };
  return { Origin: new URL(page.url()).origin, 'X-CSRF-Token': data.csrfToken };
}

async function addProject(page: Page, name: string, headers: Record<string, string>) {
  const response = await page.request.post(api + '/projects', { data: { name }, headers });
  expect(response.status()).toBe(201);
  return (await response.json() as { data: { id: string } }).data.id;
}

async function addEntry(page: Page, data: { projectId: string; workSummary: string; sessionDate: string }, headers: Record<string, string>) {
  const response = await page.request.post(api + '/sessions', { data, headers });
  expect(response.status()).toBe(201);
}

function observeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    // Expected API errors are asserted by individual journeys.
    if (message.location().url.includes('/api/v1/') &&
        /Failed to load resource.*(?:401|403|404|409|503)/.test(message.text())) return;
    errors.push(message.text() + (message.location().url ? ' at ' + message.location().url : ''));
  });
  return errors;
}

test('protects deep links, restores a cookie session, rejects invalid login and revokes access', async ({ page, context }) => {
  const errors = observeErrors(page);
  await page.goto('/projects?offset=20');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter your username.')).toBeVisible();
  await page.getByLabel('Username').fill(fixtureOwner);
  await page.getByLabel('Password').fill(fixturePassword + '-invalid');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid username or password.')).toBeVisible();
  await page.getByLabel('Password').fill(fixturePassword);
  await page.getByLabel('Password').press('Enter');
  await expect(page).toHaveURL(/\/projects\?offset=20$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const cookie = (await context.cookies()).find(item => item.name === 'devtrail.sid');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookies: document.cookie })))
    .toEqual({ local: 0, session: 0, cookies: '' });

  const headers = await ownerHeaders(page);
  const noCsrf = await page.request.post(api + '/projects', { data: { name: 'forbidden' }, headers: { Origin: headers.Origin } });
  expect(await noCsrf.json()).toMatchObject({ error: { code: 'CSRF_FORBIDDEN' } });
  const badOrigin = await page.request.post(api + '/projects', { data: { name: 'forbidden' }, headers: { ...headers, Origin: 'https://example.test' } });
  expect(await badOrigin.json()).toMatchObject({ error: { code: 'ORIGIN_FORBIDDEN' } });

  // Revoke the active session, then exercise the 401 path in the mounted app.
  expect(cookie).toBeDefined();
  const revoked = await page.request.post(api + '/auth/logout', {
    headers: { ...headers, Cookie: cookie!.name + '=' + cookie!.value },
  });
  expect(revoked.status()).toBe(204);
  await page.getByRole('link', { name: 'Timeline', exact: true }).click();
  await expect(page.getByText('Your session ended. Sign in to continue.')).toBeVisible();

  await page.getByLabel('Username').fill(fixtureOwner);
  await page.getByLabel('Password').fill(fixturePassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Daily Timeline' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect((await page.request.get(api + '/projects')).status()).toBe(401);
  expect(errors).toEqual([]);
});

test('recovers from an unavailable session lookup and from a cookie rotated in another tab', async ({ page }) => {
  const errors = observeErrors(page);
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 503, json: { error: { code: 'FIXTURE', message: 'Session lookup unavailable.' } },
  }), { times: 1 });
  await page.goto('/projects/new');
  await expect(page.getByText('Session lookup unavailable.')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByLabel('Username').fill(fixtureOwner);
  await page.getByLabel('Password').fill(fixturePassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible();

  // The request shares browser cookies and rotates the server session without updating the open page.
  const headers = await ownerHeaders(page);
  const rotated = await page.request.post(api + '/auth/login', {
    headers, data: { username: fixtureOwner, password: fixturePassword },
  });
  expect(rotated.status()).toBe(200);

  const name = 'Rotated session ' + randomUUID().slice(0, 8);
  await page.getByLabel('Project name').fill(name);
  const csrfRejection = page.waitForResponse(response => response.url().endsWith(api + '/projects') &&
    response.request().method() === 'POST' && response.status() === 403);
  await page.getByRole('button', { name: 'Create project' }).click();
  expect(await (await csrfRejection).json()).toMatchObject({ error: { code: 'CSRF_FORBIDDEN' } });
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('Project created.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('creates, edits, pages through and deletes projects with confirmation', async ({ page }) => {
  const errors = observeErrors(page);
  const name = 'Project ' + randomUUID().slice(0, 8);
  await signIn(page, '/projects');
  await page.getByRole('link', { name: 'New project', exact: true }).first().click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText('Project name is required.')).toBeVisible();
  await page.getByLabel('Project name').fill('x'.repeat(121));
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText('Project name must be at most 120 characters.')).toBeVisible();
  await page.getByLabel('Project name').fill(name);
  await page.getByLabel('Description').fill('Initial project notes');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('Project created.')).toBeVisible();

  const projectUrl = page.url();
  await page.getByRole('link', { name: 'Edit project' }).click();
  await page.getByLabel('Project name').fill(name + ' revised');
  await page.getByLabel('Description').clear();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: name + ' revised' })).toBeVisible();
  await expect(page.getByText('Initial project notes')).toHaveCount(0);

  await page.goto('/projects/new');
  await page.getByLabel('Project name').fill((name + ' revised').toUpperCase());
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText('A project already uses that name.')).toBeVisible();
  await expect(page.getByLabel('Project name')).toHaveValue((name + ' revised').toUpperCase());

  const headers = await ownerHeaders(page);
  for (let index = 0; index < 20; index++) await addProject(page, name + ' fixture ' + index, headers);
  await page.goto('/projects');
  await page.getByRole('link', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/offset=20$/);
  await expect(page.getByText('Page 2', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Previous page' }).click();
  await expect(page.getByText('Page 1', { exact: true })).toBeVisible();

  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Delete project' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete project' })).toBeFocused();
  await page.getByRole('button', { name: 'Delete project' }).click();
  await dialog.getByRole('button', { name: 'Delete project' }).click();
  await expect(page.getByText('Project deleted.')).toBeVisible();
  await page.goto(projectUrl);
  await expect(page.getByText('Project not found.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('records, reassigns and deletes a session while protecting referenced projects', async ({ page }) => {
  const errors = observeErrors(page);
  const name = 'Session project ' + randomUUID().slice(0, 8);
  await signIn(page);
  const headers = await ownerHeaders(page);
  const firstProject = await addProject(page, name, headers);
  const secondProject = await addProject(page, name + ' destination', headers);
  await page.goto('/projects/' + firstProject);
  await page.getByRole('main').getByRole('link', { name: 'Log session' }).click();
  await expect(page.getByLabel('Project', { exact: true })).toHaveValue(firstProject);
  await page.getByLabel('Session date').fill('2999-01-01');
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByText('Choose today or an earlier date in Europe/Istanbul.')).toBeVisible();
  await expect(page.getByText('Work summary is required.')).toBeVisible();

  await page.getByLabel('Session date').fill('2026-01-02');
  await page.getByLabel('Work focus').fill('API review');
  await page.getByLabel('Work summary').fill('Documented the first boundary case.');
  await page.getByLabel('Learning notes').fill('Keep date-only values intact.');
  await page.getByLabel('Difficulties').fill('Calendar conversion');
  await page.getByLabel('Next steps').fill('Review the integration tests.');
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByText('Session recorded.')).toBeVisible();
  await expect(page.getByText('Friday, January 2, 2026', { exact: true })).toBeVisible();
  await expect(page.getByText('Keep date-only values intact.')).toBeVisible();

  const sessionUrl = page.url();
  await page.goto('/projects/' + firstProject);
  await page.getByRole('button', { name: 'Delete project' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete project' }).click();
  await expect(page.getByText('A project with development sessions cannot be deleted.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await page.goto(sessionUrl);
  await page.getByRole('link', { name: 'Edit session' }).click();
  await page.getByLabel('Project', { exact: true }).selectOption(secondProject);
  await page.getByLabel('Session date').fill('2026-01-03');
  await page.getByLabel('Work summary').fill('Updated the boundary case.');
  await page.getByLabel('Learning notes').clear();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Session updated.')).toBeVisible();
  await expect(page.getByText('Updated the boundary case.')).toBeVisible();
  await expect(page.getByText('Keep date-only values intact.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: name + ' destination', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete session' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Updated the boundary case.')).toBeVisible();
  await page.getByRole('button', { name: 'Delete session' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete session' }).click();
  await expect(page.getByText('Session deleted.')).toBeVisible();
  await page.goto(sessionUrl);
  await expect(page.getByText('Development session not found.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('filters and pages grouped history, recovers from read failure and fits a narrow viewport', async ({ page }) => {
  const errors = observeErrors(page);
  const name = 'History ' + randomUUID().slice(0, 8);
  await signIn(page);
  const headers = await ownerHeaders(page);
  const primary = await addProject(page, name, headers);
  const secondary = await addProject(page, name + ' other', headers);
  for (let index = 0; index < 21; index++) {
    await addEntry(page, { projectId: primary, sessionDate: '2026-02-18', workSummary: name + ' entry ' + index + '.' }, headers);
  }
  await addEntry(page, { projectId: primary, sessionDate: '2026-02-17', workSummary: 'Earlier fixture entry.' }, headers);
  await addEntry(page, { projectId: secondary, sessionDate: '2026-02-18', workSummary: 'Other project fixture entry.' }, headers);

  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto('/timeline');
  await page.getByLabel('Project', { exact: true }).selectOption(primary);
  await page.getByLabel('From date').fill('2026-02-19');
  await page.getByLabel('To date').fill('2026-02-18');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByText('To date must be on or after from date.')).toBeVisible();
  await page.getByLabel('From date').fill('2026-02-18');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('heading', { name: 'Wednesday, February 18, 2026' })).toBeVisible();
  const group = page.getByRole('region', { name: 'Wednesday, February 18, 2026' });
  await expect(group.getByText(new RegExp(name + ' entry '))).toHaveText(
    Array.from({ length: 20 }, (_, index) => name + ' entry ' + (20 - index) + '.'),
  );
  await expect(page.getByText('Other project fixture entry.')).toHaveCount(0);
  await expect(page.getByText('Earlier fixture entry.')).toHaveCount(0);
  await page.getByRole('link', { name: 'Next page' }).click();
  await expect(page.getByText(name + ' entry 0.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Next page' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(name + ' entry 0.')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('projectId')).toBe(primary);
  await page.goBack();
  await expect(page.getByText(name + ' entry 20.')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('offset')).toBeNull();

  await page.goto('/projects/' + primary);
  await expect(page.getByRole('heading', { name: 'Project Journey Review' })).toBeVisible();
  await page.getByRole('link', { name: 'Next page' }).click();
  await expect(page.getByText('Earlier fixture entry.')).toBeVisible();
  await expect(page.getByText('Other project fixture entry.')).toHaveCount(0);
  await page.getByLabel('From date').fill('2026-03-01');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByText('No sessions match these filters.')).toBeVisible();

  await page.route('**/api/v1/sessions?**', route => route.fulfill({
    status: 503, json: { error: { code: 'FIXTURE', message: 'History temporarily unavailable.' } },
  }), { times: 1 });
  await page.reload();
  await expect(page.getByText('History temporarily unavailable.')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('No sessions match these filters.')).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters' }).first().click();
  await expect(page.getByText(name + ' entry 20.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  if (process.env.E2E_CAPTURE) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/journey-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'test-results/journey-desktop.png' });
  }
  expect(errors).toEqual([]);
});


test('fits all primary workspace screens at 320 CSS pixels', async ({ page }) => {
  const errors = observeErrors(page);
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto('/timeline');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await signIn(page);
  const headers = await ownerHeaders(page);
  const project = await addProject(page, 'Responsive ' + randomUUID().slice(0, 8), headers);
  const created = await page.request.post(api + '/sessions', {
    headers, data: { projectId: project, workSummary: 'Responsive fixture entry.', sessionDate: '2026-02-18' },
  });
  expect(created.status()).toBe(201);
  const { data: session } = await created.json() as { data: { id: string } };

  const screens = [
    ['/timeline', 'Daily Timeline'],
    ['/projects', 'Projects'],
    ['/projects/new', 'New project'],
    ['/projects/' + project + '/edit', 'Edit project'],
    ['/sessions/new', 'Log a session'],
    ['/sessions/' + session.id, 'Development session'],
    ['/sessions/' + session.id + '/edit', 'Edit session'],
  ] as const;
  for (const [path, heading] of screens) {
    await test.step(heading, async () => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.getByRole('main').getByRole('status')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    });
  }
  expect(errors).toEqual([]);
});

test('shows real metrics, searches evidence, exports a report, and persists appearance', async ({ page }) => {
  const errors = observeErrors(page);
  const project = 'Compiler Lab ' + randomUUID().slice(0, 6);
  await signIn(page, '/overview');
  const headers = await ownerHeaders(page);
  const projectId = await addProject(page, project, headers);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const title = 'Trace source-map resolution';
  const session = await page.request.post(api + '/sessions', { headers, data: {
    projectId, title, sessionDate: today, durationMinutes: 125, workSummary: 'Compared decoded source map locations with emitted code.',
    learningNotes: 'A source map preserves the relationship between source and generated positions.',
    technologies: ['TypeScript', 'Vite'], categories: ['Testing'],
  } });
  expect(session.status()).toBe(201);
  const milestone = await page.request.post(api + '/milestones', { headers, data: {
    projectId, title: 'Compiler diagnostics baseline', criteria: 'Document source-map boundaries.', status: 'completed', completedDate: today,
  } });
  expect(milestone.status()).toBe(201);
  const challengeTitle = 'Source-map offset mismatch ' + project.slice(-6);
  const challenge = await page.request.post(api + '/challenges', { headers, data: {
    projectId, title: challengeTitle, description: 'The first generated line used a different offset.',
    solution: 'Normalize both positions before comparing.', status: 'resolved', resolvedDate: today, technologies: ['TypeScript'],
  } });
  expect(challenge.status()).toBe(201);
  await page.reload();
  await page.locator('.filter-popover summary').click();
  await page.getByLabel('Project', { exact: true }).selectOption(projectId);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByText('2h 5m', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
  await expect(page.getByRole('link', { name: /Compiler diagnostics baseline/ })).toBeVisible();
  await page.locator('.filter-popover summary').click();
  if (process.env.E2E_CAPTURE) await page.screenshot({ path: 'test-results/v2-overview-desktop.png', fullPage: true });

  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByRole('searchbox').fill(challengeTitle);
  await page.getByRole('dialog').getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Global search' })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(challengeTitle) }).click();
  await expect(page.getByText(challengeTitle, { exact: true })).toBeVisible();
  await expect(page.getByText('Normalize both positions before comparing.')).toBeVisible();

  await page.goto('/timeline?type=challenge&group=month&projectId=' + projectId);
  await page.getByText(challengeTitle, { exact: true }).click();
  await page.getByRole('button', { name: 'Event details' }).click();
  const drawer = page.getByRole('dialog', { name: challengeTitle });
  await expect(drawer.getByRole('link', { name: 'Open challenge' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Event details' })).toBeFocused();

  await page.goto('/reports');
  await page.getByLabel('Project', { exact: true }).selectOption(projectId);
  await page.getByRole('button', { name: 'Build from records' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page).toHaveURL(/\/reports\?record=\d+$/);
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  expect((await exported).suggestedFilename()).toContain('weekly-development-report-compiler-lab');
  expect((await page.pdf()).subarray(0, 4).toString()).toBe('%PDF');
  if (process.env.E2E_CAPTURE) await page.screenshot({ path: 'test-results/v2-report-desktop.png', fullPage: true });

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Development activity' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  if (process.env.E2E_CAPTURE) await page.screenshot({ path: 'test-results/v2-overview-mobile-dark.png', animations: 'disabled', fullPage: true });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});

test('writes a session, an insight with evidence, and a report manually', async ({ page }) => {
  const errors = observeErrors(page);
  await signIn(page, '/overview');
  const headers = await ownerHeaders(page);
  const projectId = await addProject(page, 'Manual writing ' + randomUUID().slice(0, 6), headers);

  await page.getByRole('link', { name: 'Log a session', exact: true }).and(page.locator('.sidebar-action')).click();
  await expect(page).toHaveURL(/\/sessions\/new$/);
  await page.goto('/studio?projectId=' + projectId);
  await expect(page).toHaveURL(/\/sessions\/new\?projectId=\d+$/);
  await expect(page.getByLabel('Project', { exact: true })).toHaveValue(projectId);
  const sessionTitle = 'Investigate request parsing';
  await page.getByLabel('Session title').fill(sessionTitle);
  const summary = page.getByLabel('Work summary', { exact: true });
  await expect(summary).toHaveAccessibleDescription('Required for a final session. You can leave it blank when saving a draft.');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.getByText('Work summary is required.')).toBeVisible();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Draft saved.')).toBeVisible();
  const sessions = await page.request.get(api + '/sessions?projectId=' + projectId);
  expect((await sessions.json()).data).toMatchObject([{ status: 'draft', workSummary: '' }]);
  const sessionId = page.url().split('/').at(-1);

  await page.goto('/insights?projectId=' + projectId);
  await page.getByText('Related sessions', { exact: true }).click();
  await page.getByLabel('Find related sessions').fill(sessionTitle);
  await page.getByRole('checkbox').click();
  await page.getByLabel('Document title').fill('Request parsing observations');
  await page.getByLabel('Markdown content').fill('Type guards made the parser easier to reason about.');
  await page.getByRole('button', { name: 'Save insight', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Request parsing observations' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Session ' + sessionId })).toHaveAttribute('href', '/sessions/' + sessionId);

  await page.goto('/reports?projectId=' + projectId);
  await page.getByLabel('Document title').fill('Manual engineering report');
  await page.getByLabel('Markdown content').fill('Reviewed request parsing and documented the remaining edge cases.');
  await page.getByRole('button', { name: 'Save report', exact: true }).click();
  await expect(page).toHaveURL(/\/reports\?record=\d+$/);
  await expect(page.getByRole('heading', { name: 'Manual engineering report' })).toBeVisible();
  expect(errors).toEqual([]);
});
