# DevTrail API

All routes are under `/api/v1`. The contract below is implemented by Backend Core.

## Implemented contracts

`GET /api/v1/health` is public and returns HTTP 200 with `{"status":"ok"}`. It reports HTTP liveness. Unmatched routes return HTTP 404 with `{"error":{"code":"NOT_FOUND","message":"Route not found."}}`. Unexpected errors handled before the response starts return HTTP 500 with `{"error":{"code":"INTERNAL_SERVER_ERROR","message":"An unexpected error occurred."}}`.

## Approved MVP routes

| Method and path | Input | Success |
| --- | --- | --- |
| `POST /auth/login` | JSON `{username, password}` | 200 with session data and a new session cookie |
| `GET /auth/me` | Active session cookie | 200 with session data |
| `POST /auth/logout` | Active session cookie and CSRF protection | 204, clears cookie and revokes session |
| `GET /projects` | Optional pagination query | 200 with project page |
| `POST /projects` | JSON with required `name` and optional `description` | 201 with project and `Location: /api/v1/projects/{id}` |
| `GET /projects/:id` | Project ID | 200 with project |
| `PATCH /projects/:id` | JSON with at least one of `name`, `description` | 200 with updated project |
| `DELETE /projects/:id` | Project ID | 204. Returns 409 if sessions reference the project, including concurrent writes. |
| `GET /sessions` | Optional pagination, `projectId`, `from`, `to` | 200 with session page |
| `POST /sessions` | JSON with required `projectId`, `sessionDate`, `workSummary`. Optional `workFocus`, `learningNotes`, `difficulties`, `nextSteps`. | 201 with development session and `Location: /api/v1/sessions/{id}` |
| `GET /sessions/:id` | Development session ID | 200 with development session |
| `PATCH /sessions/:id` | JSON with at least one writable session field from create | 200 with updated development session |
| `DELETE /sessions/:id` | Development session ID | 204 |

## Authentication and request protection

Login accepts a username of 1–64 ASCII letters or digits with underscores, dots and hyphens permitted after the first character. Login passwords contain 1–256 Unicode code points. The provisioned owner password has the additional setup requirements in the README. Login and current-session lookup return `{"data":{"owner":{"username":"owner"},"csrfToken":"<token>","expiresAt":"<UTC timestamp>"}}`.

Use the host-only cookie issued at login for protected requests. It is named `__Host-devtrail.sid` over HTTPS and `devtrail.sid` for local loopback HTTP. On authenticated writes, send the current `csrfToken` in the `X-CSRF-Token` header. Login uses that header when replacing an active session. All writes, including login, require a matching `Origin` or the origin of `Referer` when `Origin` is absent. Auth and protected route responses use `Cache-Control: no-store`. [Session lifetime and cookie policy](ARCHITECTURE.md#selected-session-and-csrf-settings)

## Approved conventions

- A resource response is `{"data":{...}}`. A page is `{"data":[...],"pagination":{"offset":0,"limit":20,"hasMore":false}}`. HTTP 204 responses have an empty body.
- A project contains `id`, `name`, `description`, `createdAt`, and `updatedAt`. A development session contains `id`, `projectId`, `sessionDate`, `workSummary`, `workFocus`, `learningNotes`, `difficulties`, `nextSteps`, `createdAt`, and `updatedAt`. Creation, update and expiration timestamps use ISO 8601 UTC strings with milliseconds.
- IDs are positive decimal strings through the signed 64-bit maximum, with no signs or leading zeros. Session dates are Gregorian calendar dates in `YYYY-MM-DD` format, years 0001–9999. Session writes use today in Europe/Istanbul as the upper bound.
- Text is trimmed and constrained by the approved Unicode code-point limits. Required text must remain nonblank. Optional text accepts null or blank text to clear it. Omitted patch fields retain their current value. [Text limits](DATABASE.md#selected-text-limits)
- Pagination defaults to `offset=0` and `limit=20`. Offsets range from 0 to 2147483647 and limits from 1 to 100. Projects sort by descending `createdAt`, then `id`. Sessions sort by descending `sessionDate`, then `createdAt`, then `id`.
- Session filters combine with AND. Both `from` and `to` are inclusive and independently optional. When both are supplied, `from` must be on or before `to`. Equal bounds select one date. A filter with no matches returns an empty page. Daily Timeline and Project Journey Review use this same list route.
- JSON bodies must use `application/json`, fit within 256 KiB and use a supported encoding. Routes without declared request bodies reject bodies. Unknown body fields, unknown query parameters and repeated query parameters are invalid.

## Errors

Error responses use `{"error":{"code":"CODE","message":"Human-readable message."}}`. Clients can branch on status and code.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Invalid path, query, body or calendar date, including an application-level future-date rejection |
| 400 | `CONSTRAINT_VIOLATION` | Persistence rejected invalid data, including the database’s future-date guard |
| 401 | `INVALID_CREDENTIALS` | Username or password was incorrect |
| 401 | `UNAUTHENTICATED` | No active owner session |
| 403 | `HTTPS_REQUIRED`, `ORIGIN_FORBIDDEN`, `CSRF_FORBIDDEN` | Transport, origin or session-bound token check failed |
| 404 | `NOT_FOUND` | Unknown route, missing target resource or missing project on a session write |
| 409 | `PROJECT_NAME_TAKEN`, `PROJECT_HAS_SESSIONS` | Project name conflict or deletion restricted by existing sessions |
| 413 | `PAYLOAD_TOO_LARGE` | Body exceeds the request size limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Unsupported body type or encoding |
| 429 | `LOGIN_RATE_LIMITED` | Too many login attempts |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |
