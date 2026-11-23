# DevTrail

DevTrail is a full-stack web application designed to help developers document and reflect on their software engineering journey.

## Purpose

Track development sessions, document lessons learned, record technical difficulties, and review project progress over time.

## Tech Stack

- Backend: Node.js, Express 5, TypeScript
- Frontend: React, TypeScript, Vite
- Database: PostgreSQL
- ORM: Prisma
- Testing: Vitest, Supertest

## Repository Structure

- `backend/` — Backend API
- `frontend/` — Frontend application

## Run the backend

Use Node.js v26.13.1 and npm 10.8.3. From the repository root, install dependencies and start the development server with Node's native TypeScript watch mode.

```sh
cd backend
npm ci
npm run dev
```

Run `npm run typecheck` from `backend/` to check types without emitting files. To run the compiled server, stop the development server and run these commands from `backend/`.

```sh
npm run build
npm start
```

Both server scripts load an optional `backend/.env` file. Copy `backend/.env.example` to `backend/.env` to configure a local port. A `PORT` set in the process environment takes precedence. The default is `3000`, and valid ports are whole numbers from `1` to `65535`.

At the default port, `GET http://localhost:3000/api/v1/health` returns HTTP 200 with `{"status":"ok"}`.

## Development Status

Project Foundation — In Progress.

The application is currently under development.
