# Implementation Plan — Package 02 Complete Frontend

**Branch** `codex/002-complete-frontend`

**Spec** [Complete Frontend](spec.md)

## Summary

Build the private owner workspace on the merged Backend Core. Use the existing REST endpoints for sign-in, projects, sessions, and the two history views. Keep deployment work in its approved package.

## Technical context

Use strict TypeScript, React, Vite, React Router, Axios, Tailwind CSS, Redux Toolkit, and React Redux bindings. Use Vitest for domain and client tests, Playwright for real browser journeys, and ESLint with TypeScript and React Hooks rules. Use Lucide for consistent navigation and action icons.

## Constitution check

| Principle | Implementation and evidence |
| --- | --- |
| Simplicity and maintainability | Store only session status in Redux. Keep project/session payloads and form input local to the active view. Reuse session history, pagination, validation, and confirmation between routes. |
| Preserve approved architecture | Use relative `/api/v1` requests behind the Vite proxy. Follow canonical payloads, pagination, error codes, and domain rules. Preserve the Express and PostgreSQL implementation. |
| Security by default | Restore the owner from the HttpOnly cookie. Keep the CSRF token in memory, refresh it from the server after a rotation conflict, and send it on authenticated writes. Clear shared auth state on a current-session 401. Keep raw responses from reaching logs. |
| Automated verification | Test dates, Unicode, identifiers, paging, transport and authentication, then exercise the UI against the real backend and a disposable PostgreSQL database. Run existing backend verification and check the locked dependency audit. |
| Oversight and documentation | Use the approved scope, update the README and implemented status, and submit one PR for independent review. |

The design review found no required governance exceptions or material changes.

## Project structure

- `frontend/src/app/` contains routing, auth state and the workspace shell.
- `frontend/src/features/` groups auth, projects and sessions, including their types, requests and screens.
- `frontend/src/shared/` contains transport, calendar and input rules, request state and reusable UI.
- `frontend/e2e/` and `.github/workflows/frontend-ci.yml` verify browser journeys and frontend checks.

Deliver auth first, then projects, session CRUD, history and verification. [Research](research.md) · [Data model](data-model.md) · [Contract](contracts/frontend.md) · [Quickstart](quickstart.md)
