# Tasks — Package 02 Complete Frontend

## Phase 1 — Setup

- [x] T001 Configure the locked frontend stack, strict TypeScript, lint, Tailwind, and the loopback Vite proxy in `frontend/`.

## Phase 2 — Foundation

- [x] T002 Implement canonical transport, resource and page types, date and input validation, and reusable request and UI states in `frontend/src/shared/`. Cover decimal IDs, Unicode limits, and date boundaries. [Data model](data-model.md)

## Phase 3 — Owner access

- [x] T003 [US1] Implement sign-in, restore, protected routes, session expiration, logout, and CSRF handling in `frontend/src/app/` and `frontend/src/features/auth/`.
- [x] T004 [US1] Test transport and owner access using `frontend/src/` and `frontend/e2e/`.

## Phase 4 — Projects

- [x] T005 [US2] Implement project list, detail, create, edit, and confirmed deletion in `frontend/src/features/projects/`. Handle duplicate names and restricted deletion. [Data model](data-model.md)
- [x] T006 [US2] Verify project CRUD, validation, pagination, and conflicts in `frontend/e2e/`.

## Phase 5 — Development sessions

- [x] T007 [US3] Implement session creation, detail, edit, reassignment, and confirmed deletion in `frontend/src/features/sessions/`. Apply date and Unicode rules. [Data model](data-model.md)
- [x] T008 [US3] Verify session CRUD, validation, and delete cancellation in `frontend/e2e/`.

## Phase 6 — History

- [x] T009 [US4] Implement shared date history, filters, route-scoped review, and pagination in `frontend/src/features/sessions/`. [Data model](data-model.md)
- [x] T010 [US4] Verify grouped and combined-filter history, both pagination paths, and empty results in `frontend/e2e/`.

## Phase 7 — Release verification

- [x] T011 Verify keyboard and narrow layouts and check browser errors in `frontend/e2e/`.
- [x] T012 Run locked installs, dependency audits, frontend checks, and existing backend and PostgreSQL checks. Configure `.github/workflows/frontend-ci.yml` and synchronize `README.md` and `docs/`.
- [x] T013 Review the delivery diff, run Spec Kit convergence, and prepare the change for independent review.

## Dependencies and traceability

T001–T002 precede the story work. Owner access enables projects, projects enable session writes, and session reads enable history. The verification phase follows the implemented journeys.

| Requirement | Tasks |
| --- | --- |
| FR-001 and FR-002 | T002–T004 |
| FR-003 | T005–T006 |
| FR-004 | T007–T008 |
| FR-005 | T009–T010 |
| FR-006 | T002, T005–T008 |
| FR-007 | T002–T003, T005, T007, T009–T011 |
| FR-008 | T001, T004, T006, T008, T010–T013 |
