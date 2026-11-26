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

## Engineering documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Architecture and authentication](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE.md)
- [API contract](docs/API.md)
- [Roadmap and foundation verification](docs/ROADMAP.md)
