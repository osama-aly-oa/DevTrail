# DevTrail Database Design

## Approved decisions

- Use PostgreSQL and manage schema changes through Prisma Migrate.
- Use `BIGINT` identity primary keys for domain entities and `TIMESTAMPTZ` for creation and update timestamps. The backend manages `UpdatedAt`.
- Enforce integrity in PostgreSQL wherever applicable, including required fields, case-insensitive project-name uniqueness, and referential integrity.
- Make `DevelopmentSession.ProjectId` a required foreign key to `Project.Id` with `ON DELETE RESTRICT`. Multiple sessions for a project on the same date are valid.
- Store `SessionDate` as PostgreSQL `DATE`. The service layer evaluates the current date in `Europe/Istanbul` when validating it.
- Prefer `NULL` for absent optional text. See the [domain model](REQUIREMENTS.md#approved-domain-model).
- Design supporting indexes around actual query patterns.
- Use local PostgreSQL for development. Docker is optional for isolated testing.

## Selected text limits

These initial limits balance short labels with room for notes. Count Unicode code points and enforce the same maximum in API validation and PostgreSQL.

| Field | Maximum characters |
| --- | ---: |
| `Project.Name` | 120 |
| `Project.Description` | 2,000 |
| `DevelopmentSession.WorkFocus` | 240 |
| `DevelopmentSession.WorkSummary` | 5,000 |
| `DevelopmentSession.LearningNotes`, `Difficulties`, `NextSteps` | 5,000 each |

## Package 01 design work

- Select the case-insensitive uniqueness mechanism and define collation and normalization behavior. A unique expression index is a candidate if its comparison semantics match the intended behavior. Test the chosen behavior in PostgreSQL. [PostgreSQL expression indexes](https://www.postgresql.org/docs/current/indexes-expressional.html)
- Evaluate supporting indexes using the implemented session queries. Cover date filtering and ordering for the timeline, and project-filtered ordering and foreign key lookups for project review and restricted deletion. Confirm the query plans before adding indexes.

## Implementation status

The Prisma schema, migrations, owner seed, and session storage are pending. See the [authentication design](ARCHITECTURE.md#approved-authentication-design).
