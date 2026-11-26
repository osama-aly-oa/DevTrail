# DevTrail API

## Implemented contracts

`GET /api/v1/health` returns HTTP 200 with the JSON body `{"status":"ok"}`.

Unmatched routes return HTTP 404 with `{"error":{"code":"NOT_FOUND","message":"Route not found."}}`. Unexpected errors handled before headers have been sent return HTTP 500 with `{"error":{"code":"INTERNAL_SERVER_ERROR","message":"An unexpected error occurred."}}`. These shapes describe current foundation behavior.

## Approved MVP routes

All paths below are relative to `/api/v1` and are pending implementation.

| Area | Method and path |
| --- | --- |
| Authentication | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Projects | `GET /projects`, `POST /projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id` |
| Development sessions | `GET /sessions`, `POST /sessions`, `GET /sessions/:id`, `PATCH /sessions/:id`, `DELETE /sessions/:id` |

`DELETE /projects/:id` permits deletion only for projects without development sessions. PostgreSQL enforces the restriction even if a session is added concurrently. The UI requires confirmation before permanent deletion of a project or session.

## Approved conventions

- Use JSON request and response bodies, unified success and error formats, strict Zod input validation, and centralized HTTP error handling.
- Serialize `BIGINT` identifiers as strings.
- Use offset pagination with a default offset of `0`, a default limit of `20`, and a maximum limit of `100`.
- Support filtering development sessions by project and date. Sort by `SessionDate DESC`, then `CreatedAt DESC`, then `Id DESC`.
- Daily Timeline and Project Journey Review both use `GET /sessions`.
- Require an authenticated session on product endpoints and apply the selected CSRF protections to writes. See the [authentication design](ARCHITECTURE.md#selected-session-and-csrf-settings).

## Contracts to define in Package 01

- Define exact request and response payloads, status codes, success and error envelopes, and pagination metadata. Preserve the existing health response.
- Define the project and date filter parameters, date wire format, and date range semantics. Keep these consistent with date-only storage and the two session views.
- Document authentication payloads and CSRF token delivery as part of the API contract.
