# Feature Specification — Package 01 Backend Core

**Specification branch** `codex/package-01-spec`

**Created** 2026-11-26

**Status** Draft

**Input** Package 01 in the approved roadmap and the request to capture and verify the in-progress backend.

## User Scenarios & Testing

### User Story 1 — Provision the backend and sign in (P1)

As the operator, I can initialize a fresh database and provision the single owner. As the owner, I can sign in, confirm that I am signed in, and sign out so that my workspace stays private.

**Why this priority** — A working database and owner session are prerequisites for protected product operations.

**Independent test** — Start with an empty test database and verify setup and authentication without creating projects or development sessions.

**Acceptance scenarios**

1. **Given** an empty PostgreSQL database, **when** the Prisma migrations and owner provisioning run, **then** the backend starts and exactly one owner can sign in. Reapplying migrations preserves the data. Repeating provisioning for the same username with a different valid password leaves the original password intact. A different username is rejected and the account stays unchanged.
2. **Given** valid credentials, **when** the owner signs in, **then** the owner can confirm their identity and access protected operations. An unknown username and a wrong password produce the same credential error. A request without a valid session cannot access product data. A server restart with the same configuration preserves a valid session until its original deadline.
3. **Given** an active session, **when** the owner signs in again, signs out, or reaches the fixed expiration deadline, **then** the replaced, revoked, or expired session is unusable. Reads and writes leave the deadline intact, and routine cleanup keeps active sessions usable.
4. **Given** a request to change state, **when** its origin does not match or an authenticated request has a missing or mismatched session token, **then** the request is rejected without changing state. Verify the approved origin fallback and deployed cookie and transport settings with a valid session.

### User Story 2 — Manage projects (P2)

As the owner, I can create, list, view, rename, describe, and delete projects so that my work stays organized.

**Why this priority** — Projects give every development session a home.

**Independent test** — With a valid owner session, exercise the project lifecycle and use pagination and linked-session fixtures to verify restricted deletion.

**Acceptance scenarios**

1. **Given** a valid project name, **when** I create and retrieve the project, **then** its identifier and fields round-trip. I can update individual fields, clear the description, and delete the project if it has no sessions.
2. **Given** a project name is already in use, **when** I create or rename a project to the same name with different casing, **then** I receive a conflict. Two concurrent creates with equivalent names leave exactly one project.
3. **Given** a project has a development session, **when** I delete the project, **then** I receive a conflict and both records remain. If a session write races with deletion of an empty project, the final state has no orphaned session.
4. **Given** several projects, **when** I list them across pages, **then** each appears once in newest-first order, using the higher identifier first when creation times tie.

### User Story 3 — Record and maintain development sessions (P3)

As the owner, I can log work, edit or reassign it, and remove entries so that the record reflects what I did and when.

**Why this priority** — Dated development sessions are the core work record.

**Independent test** — Use an authenticated owner and two project fixtures to exercise session CRUD, then run the date-boundary cases against the real database.

**Acceptance scenarios**

1. **Given** existing projects, **when** I create a session with a valid date and summary, **then** I can retrieve it, edit only the supplied fields, clear optional notes, reassign it to another existing project, and delete it. Separate sessions can share a date.
2. **Given** a session write with a nonexistent project, a blank summary, or a malformed date, **when** the request reaches the backend, **then** I receive the corresponding missing-resource or invalid-input response and no partial write is stored.
3. **Given** a date that is tomorrow in Europe/Istanbul, **when** I submit it immediately before local midnight, **then** I receive HTTP 400. After that same date becomes today in Istanbul, a valid write is accepted even if UTC is still on the previous date.
4. **Given** application validation accepts a date that PostgreSQL still considers future in Europe/Istanbul, **when** the database rejects a create or date-changing update, **then** the response is HTTP 400 with the safe `CONSTRAINT_VIOLATION` error and persistent data stays unchanged. The in-progress create regression previously returned HTTP 500.

### User Story 4 — Retrieve development history (P4)

As the owner, I can read session history by date, by project, or by both so that the same backend supports Daily Timeline and Project Journey Review.

**Why this priority** — The two approved views need consistent, ordered data before the frontend can use it.

**Independent test** — Seed a fixed set across two projects and multiple dates, including records with tied timestamps, then request filters and successive pages.

**Acceptance scenarios**

1. **Given** sessions across projects and dates, **when** I request a project, a date, or an inclusive date range with either bound optional, **then** only matching records appear. A valid filter with no matches returns an empty page.
2. **Given** an unchanged result set with tied dates and creation times, **when** I page through the results, **then** I see the approved ordering and each matching row once. The page information identifies the end of the results.

### Edge Cases

| Case | Expected result |
| --- | --- |
| Unknown fields, repeated or invalid query parameters, a reversed date range, an empty partial update, an invalid page bound, or malformed JSON | Reject the request with HTTP 400 and leave stored data unchanged. |
| Oversized body or unsupported request media type | Return a structured HTTP 413 or 415 error, respectively. |
| Malformed or out-of-range identifier versus a valid identifier with no matching resource | Return HTTP 400 for invalid input and HTTP 404 for the missing detail or write target. Valid large identifiers retain all digits. |
| Whitespace-only required text or text at and beyond an approved Unicode limit | Reject blank required text, accept valid text at the limit, and reject text above it at both the request and persistence boundaries where applicable. [Database text limits](../../docs/DATABASE.md#selected-text-limits) |
| Omitted optional field on a partial update versus an explicit clear | Leave omitted fields as stored. Persist a cleared optional field as absent. |
| Impossible calendar date, future session date, or a valid leap day | Reject impossible and future dates and preserve valid dates as date-only values on readback. |
| Unknown route or unexpected backend failure | Preserve the foundation’s public error behavior. Keep credentials, private session data, raw request bodies, and internal error details out of error responses and logs. [Implemented contracts](../../docs/API.md#implemented-contracts) |

## Requirements

### Functional Requirements

- **FR-001** — Apply versioned Prisma migrations to an empty PostgreSQL database and reapply them safely. Create and enforce the approved domain and authentication data model, including identity and timestamp types, required data, text limits, name uniqueness, and referential integrity. [Database design](../../docs/DATABASE.md#approved-decisions)
- **FR-002** — Provision exactly one owner from configured credentials, store the password only as an Argon2id hash, and retain existing credentials on rerun. Reject conflicting owner provisioning without replacing the account. [Authentication design](../../docs/ARCHITECTURE.md#approved-authentication-design)
- **FR-003** — Support owner login, current-session lookup, and logout. Require a valid owner session for protected operations and return a generic error for invalid credentials. [Approved authentication routes](../../docs/API.md#approved-mvp-routes)
- **FR-004** — Persist owner sessions across requests and server restarts. Rotate the session identifier on login, enforce the approved fixed deadline on the server and cookie, invalidate it on logout, and clean up expired sessions without affecting active ones. [Session settings](../../docs/ARCHITECTURE.md#selected-session-and-csrf-settings)
- **FR-005** — Enforce the approved transport, cookie, origin, and session-bound CSRF requirements. Rejected requests must leave product data and authentication state unchanged. [Session and CSRF settings](../../docs/ARCHITECTURE.md#selected-session-and-csrf-settings)
- **FR-006** — Provide all approved project operations. Allow an optional description and partial updates, apply case-insensitive name uniqueness on create and update, and enforce restricted deletion even with concurrent session writes. [Business rules](../../docs/REQUIREMENTS.md#business-rules) · [API](../../docs/API.md#approved-mvp-routes)
- **FR-007** — Provide all approved development-session operations. Require a summary and an existing project, permit reassignment and same-day sessions, and support clearing optional text on update. [Business rules](../../docs/REQUIREMENTS.md#business-rules) · [API](../../docs/API.md#approved-mvp-routes)
- **FR-008** — Treat session dates as calendar dates and reject future values on create and update using Europe/Istanbul. Surface a database date-guard rejection as a safe HTTP 400 `CONSTRAINT_VIOLATION`, with no persisted invalid write.
- **FR-009** — Paginate projects and development sessions using the approved defaults and bounds, with stable ordering for unchanged data. Let clients combine project and inclusive calendar-date filters for session history and preserve the approved session ordering. [API conventions](../../docs/API.md#approved-conventions)
- **FR-010** — Strictly validate bodies, paths, and query parameters. Preserve exact decimal identifiers, date-only values, and the approved text limits across reads and writes. [API conventions](../../docs/API.md#approved-conventions) · [Text limits](../../docs/DATABASE.md#selected-text-limits)
- **FR-011** — Use consistent JSON envelopes for product responses with a body and centralize error handling. Distinguish invalid input, authentication or request-protection failures, not-found cases, conflicts, and unexpected failures. Preserve the foundation health and error contracts and keep sensitive details out of responses and logs. [Implemented contracts](../../docs/API.md#implemented-contracts)

### Key Entities

- **Owner account** — The single account authorized to use DevTrail.
- **Owner session** — A revocable, time-limited sign-in tied to the owner.
- **Project and development session** — A project groups development sessions, and each session belongs to one existing project. [Approved domain model](../../docs/REQUIREMENTS.md#approved-domain-model)

### Test Requirements

- Use automated HTTP and real PostgreSQL integration tests to cover the acceptance scenarios, fresh and repeated migrations, repeated seed runs, authentication, session expiry and cleanup, database constraints, and both concurrent-write cases.
- Include a regression for the known Istanbul midnight and database date-guard behavior. Verify the client error and persisted state in both the create and date-changing update paths. Exercise database enforcement on its own as well as the public response.
- Use a disposable database or isolated test schema and fixture credentials. Run the backend type-check, automated tests including the PostgreSQL suite, and build locally and in Backend CI. Verify the existing health and error contracts as part of the suite.

## Success Criteria

### Measurable Outcomes

- **SC-001** — Clean setup and a repeat run leave exactly one working owner account. All sign-in, session expiry, and sign-out acceptance scenarios pass, with zero unauthorized changes.
- **SC-002** — Every approved project and development-session operation passes its positive and applicable negative acceptance cases. Concurrent cases leave zero duplicate project names and zero orphaned development sessions.
- **SC-003** — The same date is rejected immediately before Istanbul midnight and accepted at the boundary in the controlled test. Every database date-guard rejection in the regression cases returns the expected client error and leaves stored data unchanged.
- **SC-004** — On the fixed two-project fixture, paging returns every matching record exactly once in the expected order, with zero out-of-filter records and correct end-of-results information.
- **SC-005** — All required automated verification passes without skipping the Istanbul regression or the existing health and error checks.

## Assumptions

- Package 01 covers the backend for the approved single-owner MVP. Frontend screens and deletion confirmation are Package 02 work. [Roadmap](../../docs/ROADMAP.md#approved-delivery-packages)
- The existing Backend Core changes inform the draft where the approved sources leave details open. Retain the current inclusive date bounds and deterministic project list order as planning defaults. Verify the draft wire details, including filter names, response bodies, pagination metadata, and CSRF token delivery, and record them in the canonical API document as part of Package 01. [API contract work](../../docs/API.md#contracts-to-define-in-package-01)
- Confirm name comparison semantics and index choices in planning and verification. Reuse the in-progress implementation where it meets the approved design and acceptance criteria. [Database design work](../../docs/DATABASE.md#package-01-design-work)
- Material changes to approved scope, architecture, stack, or public contracts require human approval. No such change is proposed in this specification. [Engineering instructions](../../AGENTS.md)
