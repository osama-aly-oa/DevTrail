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

## Implemented Backend Core

Express app construction remains separate from server startup. Startup validates configuration and checks PostgreSQL connectivity. Routing and transport policy are in the controller and middleware modules. Date policy and persistence are in the domain modules.

Owner provisioning stores an Argon2id hash. Express sessions use the PostgreSQL store through connect-pg-simple, with a fixed expiry and periodic cleanup. The login route limits repeated credential attempts. Expected errors use the canonical JSON envelope. Unexpected errors log a fixed message without request data, credentials, session contents or raw database errors. [API contract](API.md) · [Verification](ROADMAP.md#package-01-verification)

## Implemented frontend

React Router protects the workspace until `GET /auth/me` resolves. Redux Toolkit holds session state in page memory with Redux DevTools disabled. The browser manages the HttpOnly cookie. Axios sends relative `/api/v1` requests and supplies the session-bound token on writes. A protected request that reports an ended session returns the owner to sign-in. A write rejected for a stale CSRF token can look up the current session and retry once.

Project and session data stay in the routes that use them. Vite proxies the API to loopback in development, and history routes use the same paginated list endpoint. The URL keeps applied filters and offsets so the owner can reload or navigate back to a review. [Frontend contract](../specs/002-complete-frontend/contracts/frontend.md) · [Local setup](../README.md#frontend-setup-and-development)
