# DevTrail Requirements

DevTrail is a Developer Journey and Engineering Reflection Platform. It helps developers document their work, learning, technical difficulties, and next steps throughout software projects.

## Approved MVP scope

- A single owner can log in and log out.
- The owner can manage projects and development sessions.
- Daily Timeline presents development sessions by date.
- Project Journey Review presents development sessions for a project.

Outside the MVP are public registration, multi-user functionality, role-based access control (RBAC), collaboration, milestone and challenge management, task management (including task boards), GitHub integration, and AI integration in the product.

## Approved domain model

| Entity | Fields |
| --- | --- |
| Project | `Id`, `Name`, `Description`, `CreatedAt`, `UpdatedAt` |
| DevelopmentSession | `Id`, `ProjectId`, `SessionDate`, `WorkSummary`, `WorkFocus`, `LearningNotes`, `Difficulties`, `NextSteps`, `CreatedAt`, `UpdatedAt` |

### Business rules

- Project names must be non-blank and unique regardless of case. PostgreSQL enforces uniqueness. A project description is optional.
- Every development session belongs to an existing project and may be reassigned to another existing project.
- `WorkSummary` is required and non-blank. `WorkFocus`, `LearningNotes`, `Difficulties`, and `NextSteps` are optional.
- `SessionDate` may be today or earlier. Evaluate today in `Europe/Istanbul`. Multiple sessions on the same date are allowed.
- A project with development sessions cannot be deleted. Permanent deletion requires UI confirmation.
- Store absent optional text as `NULL` where possible.

## Implementation status

The current branch implements the backend foundation. All MVP product features are pending. See the [database design](DATABASE.md#selected-text-limits) for text limits and the [API contract](API.md#approved-mvp-routes) for the project deletion route.
