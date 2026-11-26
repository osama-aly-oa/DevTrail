# Feature Specification — Package 02 Complete Frontend

**Feature branch** `codex/002-complete-frontend`

**Created** 2026-11-26

**Status** Ready for implementation

**Input** Package 02 in the [approved roadmap](../../docs/ROADMAP.md#approved-delivery-packages) and the requested implementation and verification brief.

## User Scenarios & Testing

### User Story 1 — Access the private workspace (P1)

The owner signs in, returns to the same page after refresh, and signs out. Access controls apply to direct links as well as navigation.

1. An unsigned owner opening a protected link sees sign-in. Valid credentials return them to that page. Invalid credentials show a retryable error.
2. Refreshing an authenticated page restores access. A missing or expired session returns to sign-in without showing private content. A temporary restore failure offers retry.
3. Signing out revokes the session. Reloading a protected page after sign-out requires credentials.

### User Story 2 — Manage projects (P2)

The owner creates, reads, edits, pages through, and deletes projects independently of session recording.

1. A valid project appears in the list and its detail view. The owner can rename it or clear its description. Blank and overlong names show field errors.
2. A case-equivalent name shows a conflict while preserving the form. The owner can cancel deletion, confirm deletion of an empty project, or see why deletion was blocked when sessions exist.
3. A fixture with 21 projects shows a second page, and the owner can return to the first.

### User Story 3 — Record and maintain development sessions (P3)

The owner records work for an existing project, reviews all details, edits the entry, reassigns it, and confirms removal.

1. The owner can save a valid summary and date with optional focus, learning notes, difficulties, and next steps. Blank summaries and dates after today in Istanbul show field errors. Same-day entries are allowed.
2. The owner can reassign a session, edit its date and summary, clear optional text, and see the saved values.
3. Canceling removal preserves the session. Confirming deletes it. With zero projects, the recording form directs the owner to create a project first.

### User Story 4 — Review dated and project history (P4)

The owner reviews sessions grouped by date in Daily Timeline and reads a project's history through Project Journey Review.

1. For a fixture across two projects and multiple dates, the timeline shows newest dates first. Project and inclusive date filters combine. A single date can be selected with equal bounds.
2. Project review fixes the project scope and supports date filters. Paging preserves the current filters. Reload and back navigation retain applied filters and page. A reversed range shows a field error.
3. Empty results offer a path to clear filters or record work. Loading, request errors, missing records, and completed writes are distinguishable.

### Edge Cases

- Browser refresh, session expiry during use, cancellation of in-flight reads, and a recoverable request failure.
- Deleting a project that gained a session since the last read, or editing a resource removed in another tab.
- Character limits count Unicode code points after trimming. Calendar dates stay on the same day across browser time zones. Resource links preserve every digit of large identifiers.
- All primary actions work with a keyboard and at a 320 CSS pixel viewport without horizontal page scrolling.

## Requirements

### Functional Requirements

- **FR-001** — Sign the owner in and out, restore authentication on load, protect private routes, and handle server-reported expiry.
- **FR-002** — Preserve the agreed same-origin session and request protections. Keep credentials and request-protection tokens out of persistent browser storage.
- **FR-003** — Provide project creation, paginated listing, detail, editing, and deletion. Surface duplicate and restricted deletion errors.
- **FR-004** — Provide development session creation, detail, editing, reassignment, and deletion with the approved fields and Istanbul date rule.
- **FR-005** — Group Daily Timeline by date and provide Project Journey Review scoped to its project. Support pagination and inclusive date filters, and allow project filtering on the timeline.
- **FR-006** — Validate inputs before writes, preserve entered values on a failed write, and confirm permanent deletion of either entity.
- **FR-007** — Provide accessible keyboard navigation, labeled inputs and feedback, responsive layouts, recoverable errors, loading, empty, and success states.
- **FR-008** — Verify the production build, the approved backend and database integration, and primary browser journeys. Run frontend checks in CI.

### Key Entities

- Owner session, project, and development session as described in [Requirements](../../docs/REQUIREMENTS.md#approved-domain-model).

## Success Criteria

- **SC-001** — A protected deep link survives sign-in and reload. Sign-out and session expiry each return the owner to sign-in without exposing the protected view.
- **SC-002** — Both entities complete every CRUD operation with persisted readback. Duplicate project names and restricted deletion are visible and leave data intact. Canceling either deletion leaves the record intact.
- **SC-003** — Across a two-project, multi-date fixture with more than one page, history shows all expected matches in order with zero out-of-filter entries.
- **SC-004** — A keyboard user can submit forms and dismiss confirmation. The primary views at 320 CSS pixels fit the viewport, and browser checks report zero unexpected console errors.
- **SC-005** — Locked installation, static checks, automated tests, and production builds succeed. Real database and browser checks verify the main journeys.

## Assumptions

- Daily Timeline is the default authenticated destination. Project detail is also the Project Journey Review.
- The existing [API and business rules](../../docs/API.md) are authoritative. The [roadmap](../../docs/ROADMAP.md) assigns production release and broader quality work to later packages.
