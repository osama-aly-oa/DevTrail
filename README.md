# DevTrail

DevTrail is a Developer Journey and Engineering Reflection Platform for recording development work, lessons learned, technical difficulties, and next steps across software projects.

The Backend Core provides owner authentication, projects and development sessions. The frontend is a placeholder. [Delivery status and verification](docs/ROADMAP.md)

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
