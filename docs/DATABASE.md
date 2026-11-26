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

The migration applies NFC normalization and an ICU root collation that ignores case while preserving accent differences for the project-name unique index. Integration tests verify equivalent accented forms collide and accent distinctions remain significant.

The migration adds ordering indexes for projects and date-ordered sessions. The project-scoped session index also supports foreign-key lookups for restricted deletion. A database guard checks session dates in Europe/Istanbul on insert and date-changing update, alongside the application rule.

## Implementation status

The Prisma schema and migration define projects, development sessions, the singleton owner account and the server-side session store. PostgreSQL enforces identity, required data, text limits, name uniqueness, referential integrity and future-date rejection. [Backend setup](../README.md#backend-setup-and-development) · [Verification](ROADMAP.md#package-01-verification)
