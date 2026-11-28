# DevTrail

DevTrail is a private developer growth workspace. Record development sessions, follow project milestones, build a technical knowledge base, and review your progress using data from your own work.

- Overview and analytics show recorded time, activity trends, streaks, and recent work.
- Project workspaces connect sessions, learning, milestones, challenges, and GitHub activity.
- Write sessions, insights, reflections, and reports manually. Reports can also start from a summary of saved records.
- Learning goals, technical reflections, and saved reports keep evidence and self-assessment visible.
- Global search, a command palette, and system, light, and dark themes are available throughout the workspace.

The monorepo uses React, TypeScript, Vite, Tailwind CSS, React Router, Axios, and Redux Toolkit on the frontend. The backend uses Node.js, Express, TypeScript, Zod, Prisma, and PostgreSQL. The single owner signs in with a PostgreSQL-backed server session. [Architecture](docs/ARCHITECTURE.md)

<a name="backend-setup-and-development"></a>

## Local setup

Use Node.js 26.13.1, npm 10.8.3, and PostgreSQL 18 with UTF-8 and ICU support. Create a local database and role, then copy [the environment example](backend/.env.example) to `backend/.env` and set the following values there.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL for the local database |
| `SESSION_SECRET` | 32 random bytes encoded as 64 hexadecimal characters. The environment example includes a generation command. |
| `APP_ORIGIN` | `http://127.0.0.1:5173` for the default Vite server |
| `OWNER_USERNAME`, `OWNER_PASSWORD` | Initial owner credentials. Use a nonblank password of 12–256 Unicode code points. |
| `PORT` | Backend listener port, defaulting to 3000 |

Run from `backend/`. The seed retains the existing owner credentials on repeat runs.

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

<a name="frontend-setup-and-development"></a>

In a second terminal, run from `frontend/`.

```sh
npm ci
npm run dev
```

Open [the local workspace](http://127.0.0.1:5173) and sign in as the provisioned owner. The browser origin must match `APP_ORIGIN` exactly. Vite proxies `/api` to the backend on port 3000. Set the frontend process variable `DEVTRAIL_API_PORT` if you change that port.

For an existing database, run `npm run db:status` and `npm run db:migrate` from `backend/` with its existing connection configuration. The V2 migration adds fields and tables and retains existing records. Existing projects default to Active and existing sessions default to Final. [Database design](docs/DATABASE.md)

## GitHub setup

Connect a GitHub repository to a project in **GitHub**, then select **Sync now**. Public repositories work without a token. For an authorized private repository, set `GITHUB_TOKEN` on the backend to a fine-grained token with read access to Contents and Pull requests on the selected repositories. Synchronization imports up to 90 default-branch commits and 90 recently updated pull requests per refresh. The GitHub token stays in backend configuration. [GitHub REST API documentation](https://docs.github.com/en/rest)

<a name="frontend-verification"></a>
<a name="testing-and-build"></a>

## Verification

Run the backend checks from `backend/` and frontend checks from `frontend/`.

| Backend | Frontend |
| --- | --- |
| `npm run db:validate` | `npm run lint` |
| `npm run typecheck` | `npm run typecheck` |
| `npm test` | `npm test` |
| `npm run test:db` | `npm run test:e2e` |
| `npm run build` | `npm run build` |

GitHub Actions runs these checks on pull requests targeting `main` and on pushes to `main`, using PostgreSQL 18. [Backend CI](.github/workflows/backend-ci.yml) · [Frontend CI](.github/workflows/frontend-ci.yml)

Set `TEST_DATABASE_URL` to a dedicated `devtrail_test_*` database, separate from the application database. The PostgreSQL suite applies both migrations in an isolated fixture schema and cleans up that schema when finished.

For browser tests, migrate and seed a dedicated `devtrail_test_*` database with fixture credentials. Build both packages, provide `E2E_DATABASE_URL`, `E2E_OWNER_USERNAME`, and `E2E_OWNER_PASSWORD`, then run `npx playwright install chromium` and `npm run test:e2e` from `frontend/`. Set `E2E_CHROMIUM_PATH` to use an installed Chromium browser and `E2E_CAPTURE=1` to save screenshots in `frontend/test-results/`. The suite starts the API on port 3102 and Vite preview on port 5174. Override the defaults with `E2E_API_PORT` and `E2E_BROWSER_PORT`. [Local verification and release status](docs/ROADMAP.md)

## Spec-driven development

The [DevTrail Constitution](.specify/memory/constitution.md) governs feature work and
material changes. Humans own requirements, specifications, architecture, technical
planning, and acceptance criteria. AI agents assist throughout the process and
primarily implement and verify approved decisions. [Engineering instructions](AGENTS.md)

Use Python 3.11 or newer as `python` with the checked-in skills. For Spec Kit CLI maintenance, install the pinned release with `python -m pip install specify-cli==1.4.5` in an isolated Python environment and confirm it with `specify version`. [Upstream license](.specify/LICENSE)

1. In Spec Kit, document the outcome, compatibility boundaries, acceptance criteria,
   and applicable test requirements in the feature specification. Obtain explicit
   human approval of the specification before advancing.
2. If open questions require clarification, obtain explicit human approval of the
   clarification artifacts before planning.
3. In the plan's Constitution Check, explain how the design preserves useful
   functionality, visual quality, usability, and product value where applicable.
   Identify reused components, justify new abstractions and dependencies through
   concrete requirements, and include verification commands. Obtain explicit human
   approval of the planning artifacts before generating tasks.
4. Generate tasks from the approved plan. Implement and verify the approved decisions.

## Production

Build both packages. From `backend/` apply pending migrations, provision the owner if needed, and run `npm start`. Serve `frontend/dist/` and the Express API under the same HTTPS origin. Forward `/api/*` to Express and serve the SPA entry point for browser routes. Set `APP_ORIGIN` to that origin and `TRUSTED_PROXY_IPS` to the explicitly trusted proxy addresses when terminating TLS upstream. `GET /api/v1/health` provides HTTP liveness.

[Requirements](docs/REQUIREMENTS.md) · [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [API](docs/API.md) · [Roadmap](docs/ROADMAP.md)
