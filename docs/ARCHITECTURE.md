# DevTrail Architecture

## Application structure

DevTrail is a layered monolith in a two-package monorepo. `backend/src/app.ts` constructs Express and mounts the REST routers independently of server startup. Authentication lives in `auth/`, canonical records and read models in `domain/`, and external provider clients and integration routes in `integrations/`. Zod validates external input, Prisma manages persistence and transactions, and the shared error handler returns JSON errors without provider responses, credentials, or request body details.

The Vite frontend uses React, TypeScript, Tailwind CSS, React Router, Axios, and Redux Toolkit. React Router owns workspace navigation and Redux keeps the owner session available to the transport layer. The browser stores the theme and sidebar preferences. The command palette opens with Ctrl+K or Cmd+K, and workspace pages use the shared shell, type, semantic color, form, and status components.

Frontend and API share a browser origin. Vite proxies API requests in development. In production the host serves the frontend assets and forwards `/api/*` to Express under the same HTTPS origin. [Local and production setup](../README.md)

## Authentication and request protection

The PostgreSQL-backed owner session expires seven days after login. Logins regenerate the session ID, and logout destroys its server-side record. Provisioning stores an Argon2id password hash. The session cookie is host-only, HTTP-only, `SameSite=Lax`, and `Secure` on HTTPS. Local loopback HTTP is permitted in development and tests. TLS termination requires explicit trusted proxy configuration.

Protected routes require an active owner session. Writes validate the browser `Origin` or the origin of `Referer` when `Origin` is absent. Authenticated writes also require the session-bound `X-CSRF-Token` header. Login is rate-limited and returns generic invalid-credential errors. A frontend request rejected for a rotated CSRF token can obtain the new owner session and retry once.

The Markdown renderer escapes content and validates supported link protocols. Attachments are authenticated downloads with type and size checks, `Content-Disposition: attachment`, `nosniff`, and a sandbox policy. File signatures validate the declared image and PDF types.

## External integrations

**GitHub.** The client makes read-only requests to the official API using an optional server token. Bounded pagination, outbound timeouts, retry-after handling, and a database lease limit synchronized work. A successful transaction updates the repository status and upserts its activity. Failed refreshes preserve the last successful activity. Repo identity and external activity IDs are unique within their applicable scopes. Imported GitHub content remains untrusted. [GitHub pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api)

## Query and reporting design

Analytics read a consistent snapshot of canonical records. Session time comes from recorded, finalized sessions. Projects with work can be compared without storing aggregate counters. When several technologies or categories share a session, minutes are split evenly within each breakdown and integer remainder minutes go to the earliest labels. Each matching label still counts that session. Learning activity derives from learning notes and the Learning category. Date-only and timestamp events group in the Istanbul calendar. Search uses bounded database queries.

Reports are stored as reviewed Markdown snapshots. The frontend renders the report and can download Markdown or hand its print layout to the browser for PDF. Settings export a JSON snapshot of workspace records and integration metadata. Binary attachments are available from their sessions. [Database design](DATABASE.md)
