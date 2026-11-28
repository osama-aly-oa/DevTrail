# DevTrail Database Design

DevTrail uses PostgreSQL and Prisma Migrate. Use UTF-8 with ICU support for normalized, case-insensitive project and challenge name comparisons.

<a name="approved-decisions"></a>

## Migrations

| Migration | Effect |
| --- | --- |
| `20261126000000_backend_core` | Creates the project, development session, owner account, and HTTP session tables, indexes, and constraints. |
| `20261127000000_developer_growth` | Adds project and session fields, new growth and integration tables, foreign keys, checks, and indexes. Existing projects receive `active`, existing sessions receive `final`, and new label arrays are empty. Optional duration, title, and other new text are nullable. |

Apply pending migrations with `npm run db:migrate` from `backend/`. Versioned SQL carries checks, triggers, and expression indexes that Prisma model definitions alone cannot represent. Apply migrations to the configured database and keep deployed migration files immutable.

## Relationships and deletion

- `development_session` requires a project. Projects with sessions, milestones, or challenges are protected by restricting foreign keys.
- Attachments use bounded `BYTEA` rows and cascade with a deleted session. Five attachments are allowed per session. The API locks the parent session before testing that quota.
- Milestones, challenges, learning goals, insights, and reflections can link to multiple sessions. Deleting a session removes links while preserving the other records. Challenges have a project-scoped, case-insensitive name constraint.
- Learning goals, reports, insights, and reflections may have no project. Deleting an eligible project clears those optional project references.
- Each project can connect one GitHub repository. The repo owner and name pair is globally unique regardless of case. An imported activity row is unique by project, kind, and external ID. Session links are unique by session and activity. Repository deletion cascades through imported activity and links. Session reassignment clears old GitHub links in the same transaction.

<a name="selected-text-limits"></a>
<a name="package-01-design-work"></a>

## Data conventions

- Domain IDs use `BIGINT` identity values and serialize as decimal strings. Event timestamps use `TIMESTAMPTZ(3)`. Record calendar dates use PostgreSQL `DATE`.
- Session date validation retains the Istanbul-calendar database trigger. Milestone completion and challenge resolution statuses require their matching dates. Finalized sessions require a summary, and duration is nullable or 1–1,440 minutes.
- Project names are limited to 120 characters and descriptions to 2,000. Session titles are limited to 160, focus to 240, and the summary and longer session notes to 5,000 each. Reports and insights can hold 30,000 characters.
- Text limits count Unicode code points. Project-name uniqueness uses NFC normalization and an ICU collation that ignores case and preserves accent distinctions.
- Technologies and tags accept 24 labels of up to 80 code points. References accept up to 24 HTTP(S) links. Optional empty text is generally stored as null.
- Queries use the project and session ordering indexes, project and milestone date lookups, challenge resolution dates, GitHub activity order and date indexes, and foreign-key indexes where needed. Analytics come from original records without materialized counters.

[Prisma schema](../backend/prisma/schema.prisma) · [API contract](API.md)
