# DevTrail

DevTrail is a Developer Journey and Engineering Reflection Platform for recording development work, lessons learned, technical difficulties, and next steps across software projects.

The private workspace includes owner sign-in, projects, development sessions, Daily Timeline, and Project Journey Review. [Delivery status and verification](docs/ROADMAP.md)

## Backend setup and development

Use Node.js 26.13.1, npm 10.8.3 and a local PostgreSQL 18 database with UTF-8 and ICU support. From `backend/`, copy `.env.example` to `.env` and fill in the values locally.

- Set `DATABASE_URL` to a PostgreSQL connection URL for the local database.
- Set `SESSION_SECRET` to a randomly generated 32-byte secret encoded as 64 hexadecimal characters.
- Set `OWNER_USERNAME` and `OWNER_PASSWORD` for initial provisioning. Use a nonblank password of 12–256 Unicode code points. Repeating provisioning retains the original password and rejects a different username.
- For local development, set `APP_ORIGIN` to the actual browser origin. The example uses `http://localhost:3000`. Set `PORT` to the listener port, defaulting to 3000.
- Deployed browser origins require HTTPS. Set `TRUSTED_PROXY_IPS` only when using an explicitly trusted proxy.

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

At the default port, `GET http://localhost:3000/api/v1/health` returns HTTP 200 with `{"status":"ok"}`. Backend startup requires database connectivity. Use `npm run build` followed by `npm start` to run the compiled server.

## Frontend setup and development

Set `APP_ORIGIN=http://127.0.0.1:5173` in the backend environment before starting it. Start the backend as above, then run these commands from `frontend/` in a second terminal.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173` and sign in with the provisioned owner. Vite forwards `/api` to port 3000 on loopback without changing the browser origin. Set the frontend process variable `DEVTRAIL_API_PORT` if the backend uses a different port. Use the same host and port in the browser and `APP_ORIGIN`.

The build emits static files to `frontend/dist/`. A deployed host needs to serve those files and the REST API from the same HTTPS origin. Serve the SPA entry point for client-side routes while forwarding `/api/*` to Express. [Architecture](docs/ARCHITECTURE.md#implemented-frontend)

## Frontend verification

From `frontend/` run:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

For browser verification, prepare a dedicated PostgreSQL database named `devtrail_test_*` with the backend migration and owner seed commands. Use fixture credentials and run `npm run build` in both packages. Supply `E2E_DATABASE_URL`, `E2E_OWNER_USERNAME`, and `E2E_OWNER_PASSWORD` through the frontend test process environment. The suite creates fixture project and session rows and exercises deletion against its own fixtures. The test runner starts the compiled backend on loopback port 3102 and Vite preview on port 5174.

```sh
npx playwright install chromium
npm run test:e2e
```

Set `E2E_CHROMIUM_PATH` to use an installed Chromium-based browser. [Frontend CI](.github/workflows/frontend-ci.yml) runs the static checks, build, and browser suite against PostgreSQL 18.

## Testing and build

From `backend/`, run the following checks. Supply `TEST_DATABASE_URL` through the process environment for a dedicated disposable database named `devtrail_test_*`, distinct from the application database. The integration suite applies migrations in a fresh schema and cleans up that schema after the run.

```sh
npm run db:validate
npm run typecheck
npm test
npm run test:db
npm run build
```

[Backend CI](.github/workflows/backend-ci.yml) runs the same checks with a PostgreSQL 18 service for pull requests targeting `main` and pushes to `main`.

## Spec-driven development

Use [GitHub Spec Kit](https://github.com/github/spec-kit) for the next bounded change in the
[approved roadmap](docs/ROADMAP.md#approved-delivery-packages). Open the repository in Codex
with Python 3.11 or newer available as `python`. The checked-in skills are ready to use.
For Spec Kit CLI maintenance, install the pinned release in an isolated Python environment
with `python -m pip install specify-cli==1.4.5` and verify it with specify version.
The generated Spec Kit files are distributed under the [upstream license](.specify/LICENSE).

1. Start from the intended base on a dedicated Git branch. Run `$speckit-specify` in Codex
   with the requested outcome and compatibility boundaries. Link the affected engineering
   documents and record acceptance criteria and applicable test requirements in `specs/`.
2. Use `$speckit-clarify` for open questions, then `$speckit-plan` to check the design
   against the [constitution](.specify/memory/constitution.md) and include relevant
   automated tests and verification commands. Resolve approval-required decisions
   according to [AGENTS.md](AGENTS.md).
3. Run `$speckit-tasks` to turn the plan into implementation and test tasks, then
   review alignment with `$speckit-analyze`.
4. Run `$speckit-implement` after reviewing the artifacts. Use `$speckit-converge` to
   check for gaps and record verification results in the pull request.

The feature artifacts describe the change under review. Link to the engineering
documentation below for existing behavior and approved decisions.

## Engineering documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Architecture and authentication](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE.md)
- [API contract](docs/API.md)
- [Roadmap and foundation verification](docs/ROADMAP.md)
