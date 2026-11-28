# DevTrail Roadmap

## Delivery status

| Package | Status |
| --- | --- |
| 01 · Backend core | PostgreSQL, owner authentication, and project and session management form the V2 base. |
| 02 · Owner workspace | The existing React sign-in, projects, sessions, and journey views are carried into V2. |
| V2 · Developer growth | The preserved baseline includes expanded sessions, growth records, analytics, timeline, reports, search, settings, manual authoring, GitHub integration, and the redesigned workspace. |
| AI-assisted writing | Deferred to a future release. |
| Production release | Deployment, remote CI verification, and independent review remain pending. |

The V2 baseline is recorded in local commits on `feat/devtrail-v2` over `e3a7f47`. The existing frontend was carried forward from `160af9b`. Individual product requirements and acceptance criteria are subject to human review and approval. [V2 baseline behavior](REQUIREMENTS.md#preserved-v2-baseline-under-review)

## Local verification

The application checks were rerun for the local baseline commits on 2026-11-28. The live public GitHub API result is from earlier V2 verification.

| Check | Evidence |
| --- | --- |
| Backend regular checks | 14 automated tests passed. Typechecking, Prisma schema validation, and the production build passed. |
| PostgreSQL integration | 32 tests passed on PostgreSQL 18 in a dedicated test database. Coverage includes fresh installation, in-place upgrade, authentication, growth records, analytics, and authenticated GitHub routes with mocked upstream responses. The removed AI routes returned 404. |
| Frontend regular checks | Lint, TypeScript checks, 12 automated tests, and the production build passed. |
| GitHub | Controlled mocks verified pagination, throttling, deduplication, session linking, and failed refresh behavior. A real read-only public GitHub API check imported 3 commits and 90 pull requests from `octocat/Hello-World` through the client and correctly reported truncated history. |
| Browser | Eight Chromium journeys passed against PostgreSQL 18. Coverage includes manually saving a session, an insight with linked evidence, and a report from scratch. The existing report builder and Markdown and PDF exports passed. Primary workspace screens were checked at 320 CSS pixels. |
| CI | Backend and frontend workflows are configured. Remote V2 results are pending publication. |

[Backend workflow](../.github/workflows/backend-ci.yml) · [Frontend workflow](../.github/workflows/frontend-ci.yml)

## Foundation verification

The foundation review at `af6c5a8` checked the repository layout, Express startup, API health, common errors, and test infrastructure. Locked install, typechecking, four backend tests, the build, and HTTP smoke checks passed locally on 2026-11-26. The backend core and owner workspace extended that base with the PostgreSQL and Chromium suites used by V2. Earlier frontend evidence is recorded in `160af9b`.

## Release limits and open checks

- Verify authorized private GitHub access with owner-supplied server configuration.
- Run deployment smoke checks with real HTTPS and trusted proxy configuration. Browser PDF output depends on the selected browser and print settings.
- GitHub synchronization provides a recent activity window, covering the default branch and recently updated pull requests. The repository view explains when older history falls outside that window.
- Data export is a JSON record snapshot. Attachment binaries are downloaded separately, and complete operational backups remain the database owner's responsibility.
- Search uses bounded database matching. Analytics are computed for the selected scope from canonical records. Large-dataset query performance remains a deployment check.

[Setup and operation](../README.md) · [Requirements](REQUIREMENTS.md)
