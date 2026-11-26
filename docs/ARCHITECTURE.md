# DevTrail Architecture

## Approved architecture

- Use a traditional layered monolith in a repository with `backend/` and `frontend/`.
- Separate Express application construction from server startup so tests can import the application directly.
- Controllers handle HTTP requests and responses. Services enforce business rules and own transaction boundaries where needed. Repositories encapsulate persistence. Middleware handles cross-cutting HTTP concerns, with centralized error handling.
- Expose a REST API under `/api/v1`.

Keep designs simple. Microservices, CQRS, event sourcing, and other material architecture changes require justification and human approval.

## Approved stack

| Area | Technology |
| --- | --- |
| Backend | Node.js, Express 5, TypeScript in strict mode, PostgreSQL, Prisma ORM and Prisma Migrate, Zod, Vitest, Supertest |
| Frontend | React, TypeScript, Vite, React Router, Tailwind CSS, Axios, Redux Toolkit |

Use Redux Toolkit for genuinely shared application state. RTK Query is outside the MVP stack.

## Approved authentication design

Use server-side sessions stored in PostgreSQL for the single owner, with an initial seven-day expiration policy. Provision the initial owner through an idempotent database seed with credentials supplied through environment variables. Hash passwords with Argon2id. Use secure session cookies and CSRF protection. Require an authenticated session on protected product endpoints. JWT, public registration, and RBAC are outside the MVP design.

### Selected session and CSRF settings

These are implementation decisions for Package 01.

- Expire sessions seven days after login and enforce the deadline server-side. Set the cookie lifetime to the same deadline. Regenerate the session identifier on login, and destroy the stored session and clear its cookie on logout.
- Set `HttpOnly`, `SameSite=Lax`, and `Path=/`, and omit `Domain` to keep the cookie host-only. Require `Secure` and HTTPS in deployed environments. Allow the secure flag to be disabled only for local loopback HTTP development. Configure trusted proxies explicitly if TLS terminates at a proxy.
- Validate the browser origin of all state-changing requests, including login, against the configured application origin. Use `Origin` with a `Referer` origin fallback, and reject requests when neither supplies a matching origin. Also require a session-bound synchronizer token in a request header for authenticated writes, including logout. Keep the token out of URLs and server logs. [OWASP CSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- Serve browser requests to the UI and API from the same origin. A local development proxy can forward API requests from the frontend.

## Implemented foundation

`backend/src/app.ts` constructs and exports the Express app. `backend/src/server.ts` validates the configured port and starts the listener. The app serves the health endpoint and installs terminal middleware for unmatched routes and unexpected errors. Vitest and Supertest cover these HTTP paths. The domain layers, persistence, authentication, Zod validation, and frontend application are pending.

## Package 01 implementation details

- Select the PostgreSQL session store library and verify server-side expiration and expired-session cleanup.
- Define CSRF token delivery and the request header name in the [API contract](API.md#contracts-to-define-in-package-01).
- Define safe logging for unexpected errors when request bodies, credentials, and session data enter the application.
