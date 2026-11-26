# DevTrail

DevTrail is a Developer Journey and Engineering Reflection Platform for recording development work, lessons learned, technical difficulties, and next steps across software projects.

The checkout contains the Express and TypeScript backend foundation. `frontend/` is a placeholder. See the [roadmap](docs/ROADMAP.md) for implementation status and verification evidence.

## Backend setup and development

Use Node.js 26.13.1 and npm 10.8.3, the versions used to verify the foundation. From the repository root, install the locked backend dependencies and start the server in watch mode.

```sh
cd backend
npm ci
npm run dev
```

Both development and production startup read an optional `backend/.env`. Copy `backend/.env.example` to `backend/.env` to configure the local port. A process-level `PORT` takes precedence. The default is `3000`, and valid values are whole numbers from `1` to `65535`. The current backend runs without a database.

At the default port, `GET http://localhost:3000/api/v1/health` returns HTTP 200 with `{"status":"ok"}`.

## Testing and build

Run these from `backend/`.

```sh
npm run typecheck
npm test
npm run build
```

Type-checking covers backend source and tests. `npm test` runs the HTTP integration suite once. Use `npm run test:watch` during development. The build emits production JavaScript to `backend/dist/`. Stop the development server before starting the compiled server on the same port with `npm start`.

[Backend CI](.github/workflows/backend-ci.yml) runs `npm ci` and these checks from `backend/` on Ubuntu with Node.js 26.13.1. It runs on pull requests targeting `main` and pushes to `main`. See the [roadmap](docs/ROADMAP.md#m1-foundation-evidence) for verification results.

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
