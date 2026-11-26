# Design Decisions

| Decision | Rationale |
| --- | --- |
| History filters and offset in the URL | Supports refresh, back navigation, and deep links to a filtered page. Applying or clearing filters returns to page one. |
| Project Journey Review at project detail | The owner can review the project and its sessions from one destination. |
| Server pagination and project selectors | Lists use the server's page metadata. Selectors page through the available project directory so older projects remain selectable. |
| Date-only representation | Gregorian strings retain the selected date across time zones. The session form compares against today's date in Europe/Istanbul. |
| Native modal dialog | Uses browser focus containment, Escape handling, and a cancel-first confirmation. |
| Real browser tests | Playwright exercises the Vite proxy, browser cookie policy, Express, and PostgreSQL together. Small Vitest tests cover deterministic boundary conditions. |

[Canonical API](../../docs/API.md) · [Architecture](../../docs/ARCHITECTURE.md)
