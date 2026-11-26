# Tasks — Package 01 Backend Core

## Phase 1 — Setup

- [x] T001 Carry the original Backend Core changes into the delivery worktree, reconcile `.gitignore`, and verify the original checkout fingerprint. See `backend/` and `.github/workflows/backend-ci.yml`.

## Phase 2 — Foundation

- [x] T002 Verify clean and repeat Prisma deployment and retained records in `backend/prisma/` and `backend/test/postgres.test.ts` (FR-001, SC-001). Check the identity and timestamp rules for [Project.id, Project.createdAt, Project.updatedAt](data-model.md#project) and [DevelopmentSession.id, DevelopmentSession.createdAt, DevelopmentSession.updatedAt](data-model.md#developmentsession).

## Phase 3 — US1 Provision and sign in

Independent test: start with a fresh database and exercise provisioning and the complete auth lifecycle.

- [x] T003 [US1] Verify the immutable owner seed, session persistence across recreation, expiry, cleanup, logout and security controls in `backend/src/auth/` and `backend/test/postgres.test.ts` (FR-002–FR-005, SC-001). Check [Owner.id, Owner.username, Owner.passwordHash, HttpSession.sid, HttpSession.sess and HttpSession.expire](data-model.md#owner-and-transport-session).

## Phase 4 — US2 Manage projects

Independent test: exercise CRUD, stable paging and both uniqueness and delete contention.

- [x] T004 [US2] Verify CRUD, validation, stable paging and database conflicts in `backend/src/domain/` and `backend/test/postgres.test.ts` (FR-006, FR-009–FR-011, SC-002). Check [Project.name and Project.description](data-model.md#project).

## Phase 5 — US3 Manage development sessions

Independent test: exercise CRUD and run application-midnight and database date-guard cases.

- [x] T005 [US3] Add persisted-state assertions for create and update date-guard rejections to `backend/test/postgres.test.ts` (FR-007, FR-008, SC-003).
- [x] T006 [US3] Correct the database check-violation mapping in `backend/src/domain/repositories.ts` and verify the session lifecycle in `backend/test/postgres.test.ts` (FR-007, FR-008, SC-002, SC-003). Check [DevelopmentSession.projectId, DevelopmentSession.sessionDate, DevelopmentSession.workSummary, DevelopmentSession.workFocus, DevelopmentSession.learningNotes, DevelopmentSession.difficulties and DevelopmentSession.nextSteps](data-model.md#developmentsession).

## Phase 6 — US4 Retrieve history

Independent test: retrieve the pages of a fixed fixture filtered by project and inclusive date bounds.

- [x] T007 [US4] Verify inclusive filters, stable ordering, empty pages, large identifiers and metadata in `backend/src/domain/` and `backend/test/postgres.test.ts` (FR-009–FR-011, SC-004).

## Phase 7 — Documentation and complete verification

- [x] T008 Publish the canonical contracts and synchronize `README.md`, `backend/.env.example`, and `docs/` (FR-001–FR-011).
- [x] T009 Run the complete local verification and confirm the hosted checks cover the same commands in `backend/package.json` and `.github/workflows/backend-ci.yml` (SC-005). Record evidence in `docs/ROADMAP.md`.

## Dependencies

T001 precedes T002. The verified foundation supports US1. US2 and US3 use owner/project fixtures, and US4 uses persisted sessions. Complete T005 before T006. Review US1 security and US4 query behavior independently once the shared fixtures are ready. T008 and T009 close the delivery after all story checks.
