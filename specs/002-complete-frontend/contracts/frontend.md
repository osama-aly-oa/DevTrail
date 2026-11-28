# Frontend Routes and API Use

| Browser path | Purpose | API usage |
| --- | --- | --- |
| `/login` | Owner access | Auth login and current-session lookup |
| `/timeline` | Daily Timeline | Session list with optional project and date filters |
| `/projects`, `/projects/new` | Project list and creation | Project list and create |
| `/projects/:projectId`, `/projects/:projectId/edit` | Project detail, edit and Journey Review | Project detail, update and delete. Project-scoped session list. |
| `/sessions/new`, `/sessions/:sessionId`, `/sessions/:sessionId/edit` | Session creation, detail, edit and deletion | Project options and development session routes |

The root routes to Daily Timeline. Protected requests, session restoration, error codes, limits, and envelopes use the unchanged [Backend Core contract](../../../docs/API.md).
