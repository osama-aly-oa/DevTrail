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

Packages 01 and 02 deliver the owner workspace, project and development session management, Daily Timeline, and Project Journey Review. Both deletion flows require confirmation. [API contract](API.md) · [Delivery status and verification](ROADMAP.md#package-02-verification)
