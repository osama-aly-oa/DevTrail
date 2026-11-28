# DevTrail API

All endpoints use `/api/v1`. `GET /health` is public and returns HTTP 200 with `{"status":"ok"}`. Product routes require a valid owner session and return `Cache-Control: no-store`.

<a name="implemented-contracts"></a>
<a name="approved-conventions"></a>

## Common contracts

- Resources return `{"data":{...}}`. Collections return `{"data":[...],"pagination":{"offset":0,"limit":20,"hasMore":false}}` unless specified below. Mutations that delete successfully return HTTP 204 with an empty body.
- IDs are positive decimal strings through the signed 64-bit maximum, without leading zeroes. Date-only fields use Gregorian `YYYY-MM-DD` and timestamps use ISO 8601 UTC. `from` and `to` are independently optional and inclusive, with `from <= to` when both are supplied. Timestamp filters use Istanbul calendar boundaries.
- Pagination defaults to `offset=0` and `limit=20`. The maximum offset is 2,147,483,647 and maximum limit is 100. Unknown fields, unknown query parameters, and repeated query values are rejected by endpoints with strict schemas.
- JSON writes require `Content-Type: application/json` and at most 256 KiB. Routes without bodies reject request bodies. Empty optional text is normalized to null. Omitted patch fields are retained.
- Errors use `{"error":{"code":"CODE","message":"Human-readable message."}}`. Common responses include 400 invalid input, 401 unauthenticated, 403 rejected origin or CSRF, 404 missing resource, 409 conflicts, 413 oversized body, 415 unsupported media, 429 rate limited, and a generic 500 response.
- Unmatched routes use `NOT_FOUND`. Unexpected errors use `INTERNAL_SERVER_ERROR`. A future session date rejected by the application uses `INVALID_INPUT`. A date rejected by the database guard uses `CONSTRAINT_VIOLATION`.

<a name="approved-mvp-routes"></a>

## Authentication

| Method and path | Contract |
| --- | --- |
| `POST /auth/login` | JSON `{username,password}`. Returns 200 and a new session cookie. |
| `GET /auth/me` | Returns the active session or 401. |
| `POST /auth/logout` | Revokes the current session and clears the cookie. Returns 204. |

Login and session lookup return `{data:{owner:{username},csrfToken,expiresAt}}`. All writes require a matching `Origin`, with the origin of `Referer` as fallback when `Origin` is absent. Authenticated writes, including a login replacing an active session, require `X-CSRF-Token`. The cookie is named `__Host-devtrail.sid` over HTTPS or `devtrail.sid` for local loopback HTTP. [Session security](ARCHITECTURE.md#authentication-and-request-protection)

Login accepts usernames of 1–64 ASCII characters, starting with a letter or digit and allowing underscores, dots, and hyphens after the first character. Login passwords accept 1–256 Unicode code points. [Owner provisioning limits](../README.md#local-setup)

## Projects and sessions

| Method and path | Input or effect |
| --- | --- |
| `GET /projects` | Filters `q`, `status`, and pagination. Newest creation date and ID first. |
| `POST /projects` | Requires `name`. Accepts `description`, `status`, `repositoryUrl`, `technologies`. Returns 201 with the project and its `Location`. |
| `GET, PATCH, DELETE /projects/:id` | Reads, updates, or removes the project. Patches require one writable field. Deletion returns 409 while a session, challenge, or milestone references the project. |
| `GET /sessions` | Filters `projectId`, `from`, `to`, `q`, `status`, `technology`, `category`, `tag`, `sort`, and pagination. `sort` is `newest` by default or `oldest`. Ties use creation date and ID. |
| `POST /sessions` | Requires `projectId`, `sessionDate`, and a nonblank `workSummary` for a final session. Returns 201 with the session and its `Location`. |
| `GET, PATCH, DELETE /sessions/:id` | Reads, updates, or removes a session. Reassignment removes old GitHub links. |

Project status is `planned`, `active`, `on_hold`, `completed`, or `archived`. Session status is `draft` or `final`, defaulting to `final`. Additional writable session fields are `title`, `durationMinutes`, `workFocus`, `learningNotes`, `difficulties`, `solutions`, `nextSteps`, `technologies`, `tags`, `categories`, and `references`. Project and session resources include `id`, `createdAt`, and `updatedAt`. [Field limits](DATABASE.md#data-conventions)

The activity category names are `Feature Development`, `Bug Fixing`, `Learning`, `Refactoring`, `Testing`, `Architecture & System Design`, `Documentation`, `DevOps & Deployment`, and `Code Review`.

`GET /sessions/:id/attachments` returns an unpaginated `data` list with `id`, `name`, `mediaType`, `size`, and `createdAt`. `POST` to the same path accepts `{name,mediaType,content}` with canonical base64 `content` and returns 201. The five-file quota and 160 KiB file limit apply. Allowed types are plain text, Markdown, CSV, JSON, PDF, PNG, and JPEG. `GET /sessions/:id/attachments/:attachmentId` downloads the file and `DELETE` removes it.

## Growth records

For each resource, `GET /resource` lists records, `POST /resource` creates one, and `GET, PATCH, DELETE /resource/:id` operate on a single record. Creates return 201 with the record and `Location`. The table lists required fields followed by optional ones. Linked resources accept a `sessionIds` array of up to 100 IDs. Sending the array on patch replaces the link selection.

| Resource | Required | Optional |
| --- | --- | --- |
| `milestones` | `projectId`, `title` | `description`, `targetDate`, `status`, `completedDate`, `criteria`, `sessionIds` |
| `challenges` | `projectId`, `title`, `description` | `rootCause`, `investigation`, `solution`, `lessons`, `status`, `resolvedDate`, `technologies`, `tags`, `references`, `sessionIds` |
| `learning-goals` | `title`, `technology` | `projectId`, `notes`, `evidence`, `understanding`, `status`, `targetDate`, `sessionIds` |
| `reports` | `title`, `kind`, `content` | `projectId`, `from`, `to` |
| `insights` | `title`, `kind`, `content` | `projectId`, `sessionIds` |
| `reflections` | `question`, `answer` | `projectId`, `feedback`, `sessionIds` |

Lists accept pagination, `q`, and `projectId`. Milestones, challenges, and learning goals apply `status`. Challenges and learning goals also apply `technology`. Reports and insights apply `kind`. Linked collections apply `sessionId`. Date filters use the applicable milestone, challenge, goal, or creation date.

Milestone and goal statuses are `planned`, `active`, and `completed`. Challenge statuses are `open`, `in_progress`, and `resolved`. Completing a milestone or resolving a challenge defaults its date to today in Istanbul when a date has yet to be recorded. Goal understanding is `exploring`, `practicing`, or `comfortable`. Report kinds are `daily`, `weekly`, `monthly`, `project`, `learning`, `challenges`, and `retrospective`.

## Search and analytics

| Method and path | Contract |
| --- | --- |
| `GET /search` | Requires `q` and accepts `projectId` and `type`. Types are `projects`, `sessions`, `learning`, `technologies`, `challenges`, `milestones`, `reports`, and `github`. `data` maps the requested groups to up to eight matches each. Entries include an identifier, title, excerpt, and applicable navigation details. |
| `GET /analytics` | Accepts `projectId`, `from`, `to`, `technology`, and `category`. Returns `totals`, `previous`, `days`, `learningDays`, `byProject`, `byTechnology`, `byCategory`, `challengeDays`, `milestoneDays`, `githubDays`, and `milestones` under `data`. `previous` uses the immediately preceding equally long period when both dates are supplied. |

## GitHub

| Method and path | Contract |
| --- | --- |
| `GET /integrations/status` | Returns `{data:{github:{authenticated}}}`. The flag indicates whether the server has a GitHub token configured. |
| `GET /github/repositories` | Returns an unpaginated repository list. |
| `GET /github/repositories/:projectId` | Returns the connected repository or `{data:null}`. |
| `POST /github/repositories` | Connects `{projectId,owner,name}` after validating access with GitHub. Returns 201. |
| `POST /github/repositories/:projectId/sync` | Triggers a bounded refresh. Takes an empty body and returns the resulting repository. |
| `DELETE /github/repositories/:projectId` | Disconnects and removes the imported activity and its links. |
| `GET /github/activity` | Paged list with `total` in addition to the standard page fields. Filters accept `projectId`, `sessionId`, `kind`, `q`, `from`, and `to`. |
| `GET /github/activity/:id` | Returns one imported activity item. |
| `GET, PUT /github/sessions/:sessionId/activity` | Reads or replaces linked activity. PUT accepts `{activityIds}` with up to 50 IDs belonging to the session project. |

A repository includes `projectId`, `owner`, `name`, `defaultBranch`, `description`, `isPrivate`, `lastSyncAt`, `syncStatus`, `syncMessage`, and `url`. Status is `idle`, `syncing`, `synced`, `partial`, or `failed`. Activity includes `id`, `projectId`, `kind` (`commit` or `pull_request`), `externalId`, `title`, `url`, `author`, `occurredAt`, and `details`. Connection and sync share a local budget of eight calls per minute per owner. An upstream GitHub throttle yields HTTP 429 with `Retry-After`.
