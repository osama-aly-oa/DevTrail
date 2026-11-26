# DevTrail Roadmap

## Approved milestones

| Milestone | Scope | Status |
| --- | --- | --- |
| M1 | Project Foundation | F01–F04 are implemented and locally verified on the foundation branch. Backend CI is configured. Formal acceptance is pending. |
| M2 | Database | Package 01 merged. |
| M3 | Authentication | Backend merged. Owner sign-in, restoration, and sign-out implemented in Package 02. |
| M4 | Projects | Backend merged. Project management implemented in Package 02. |
| M5 | Development Sessions | Backend merged. Session recording and management implemented in Package 02. |
| M6 | Daily Timeline & Project Journey Review | Package 02 implemented for review. |
| M7 | Quality, Documentation & Deployment | Packages 03–04 · Pending. Essential CI starts early. |

## M1 foundation evidence

Reviewed `feat/m1-complete-foundation` at `af6c5a8`. The checkout did not contain a standalone prior audit or a formal F01–F04 acceptance checklist. The assessment below uses the source, Git history, the F02 pull request verification checklist, and local checks.

| Task | Evidence and assessment |
| --- | --- |
| F01 — Repository and Monorepo Setup | The repository layout and ignore rules are present. `backend/` has an npm manifest and lockfile, and `frontend/` is a tracked placeholder. The monorepo setup is supported by repository inspection. |
| F02 — Backend Bootstrap | Express 5 and strict TypeScript are configured. App construction and server startup are separate, and startup validates `PORT`. Type-checking, the build, and HTTP health smoke checks against both source and compiled entry points passed, covering the known PR verification checklist. [F02 pull request](https://github.com/osama-aly-oa/DevTrail/pull/1) |
| F03 — HTTP Error Handling | Integration tests verified JSON 404 responses and generic JSON 500 responses for synchronous throws and rejected promises. The 500 tests also checked server-side logging. |
| F04 — Testing Foundation | Vitest and Supertest ran the integration suite, and the type-check included test sources. GitHub Actions runs the backend checks for pull requests targeting `main` and pushes to `main`. |

On 2026-11-26, from `backend/` with Node.js 26.13.1 and npm 10.8.3, `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` all exited successfully. Vitest passed all four tests in one file. HTTP smoke checks against the source and compiled server entry points both returned 200 with `{"status":"ok"}`.

The [Backend CI workflow](../.github/workflows/backend-ci.yml) uses Ubuntu and Node.js 26.13.1 to install locked dependencies, type-check, test, and build from `backend/`. The results above are local. GitHub reports CI results on the [foundation pull request](https://github.com/osama-aly-oa/DevTrail/pull/2/checks).

F03 delegates errors after headers are sent to Express. The current suite covers errors before headers are sent. The 500 tests mount the production handler in an isolated Express fixture. Review error logging when Package 01 introduces request bodies and authentication, since the foundation logs the raw error object.

## Approved delivery packages

Deliver packages in reviewable increments with automated tests, local verification, and documentation updates.

| Package | Scope |
| --- | --- |
| 01 — Backend Core | PostgreSQL and Prisma migrations, owner authentication and session management, Projects and Development Sessions APIs, validation and centralized errors, automated backend and database integration tests. Publish the product contracts in the canonical API document. |
| 02 — Complete Frontend | React application setup, authentication UI, project and development session management, Daily Timeline, Project Journey Review, and backend integration. |
| 03 — Engineering Quality | Security review, end-to-end tests, bug fixes, performance review, and necessary refactoring. |
| 04 — Production Release | Production configuration, CI/CD for release, deployment, and final documentation. |

The foundation includes essential backend CI. Extend it with integration checks as they become available.

## Package 01 verification

On 2026-11-26, Node 26.13.1, npm 10.8.3 and PostgreSQL 18 passed the locked install, Prisma validation, type-check, 12 regular tests, 26 PostgreSQL integration tests and production build. The install audit reported zero known vulnerabilities at the time of verification. Clean migration, owner seed, and HTTP health and login worked against PostgreSQL from both source and compiled entry points.

The database suite verifies migration reapplication, persisted sessions across restart, cookie and request protections, authorization failures, sanitized errors, simultaneous writes, and data constraints. A date rejected by the PostgreSQL Istanbul guard returns HTTP 400 on create and date-changing update. The tests verify neither rejected operation persists a change.

On a disposable fixture of 500 projects and 30,000 development sessions, PostgreSQL selected the project order index, the all-session date order index, and the project-scoped session index for date-filtered history and project-reference lookup. Package acceptance remains subject to independent review. [Backend CI configuration](../.github/workflows/backend-ci.yml)

## Package 02 verification

On 2026-11-26, locked frontend and backend installs passed on Node 26.13.1. Frontend lint, strict type-checking, eight unit tests, and the production build passed. Backend Prisma validation, type-checking, 12 regular tests, 26 database tests, and the production build also passed. Both npm audits reported zero known vulnerabilities.

Six Chromium journeys ran against the compiled frontend and backend with a freshly migrated PostgreSQL 18.4 database. They verified sign-in and restoration, revocation and logout, CSRF rejection and recovery after session rotation, project and session CRUD, validation, deletion confirmation and constraints, date and project filters, pagination and back navigation, and recovery from read errors. The primary views fit a 320 CSS pixel viewport, keyboard checks passed, and the browser reported zero unexpected console errors. The development proxy separately passed real health and sign-in smoke checks.

Hosted HTTPS and cross-browser verification remain for later packages. [Frontend CI configuration](../.github/workflows/frontend-ci.yml) · [Package 02 specification](../specs/002-complete-frontend/spec.md)
