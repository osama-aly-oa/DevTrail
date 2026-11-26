# DevTrail — Engineering Instructions

Codex implements engineering work under human supervision. Preserve working behavior and keep changes within the assigned scope.

## Sources of truth

- [Requirements](docs/REQUIREMENTS.md) defines the product scope and domain rules.
- [Architecture](docs/ARCHITECTURE.md), [Database](docs/DATABASE.md), and [API](docs/API.md) define the approved system design and track implementation decisions.
- [Roadmap](docs/ROADMAP.md) organizes delivery and records foundation verification.
- [README](README.md) describes how to run and verify the current checkout. Use npm for backend scripts and dependency management.

## Engineering workflow

- Inspect relevant code, tests, and documentation before making changes.
- Prefer complete features and coherent delivery packages. Work in reviewable increments and explain decisions that affect behavior or maintenance.
- Follow approved requirements and design. Make routine implementation decisions independently. Request approval before materially changing architecture, the technology stack, business requirements, or public API contracts.
- Prefer simple, maintainable solutions. Reuse existing code where appropriate and avoid unnecessary abstractions, dependencies, and unrelated changes.
- Add appropriate automated tests alongside features. Run the relevant verification commands before reporting completion, record the evidence, and identify any gaps, security risks, or technical debt.
- Keep documentation synchronized with implementation. Identify which decisions are approved, which details are planned, and which behavior has been implemented and verified.

## Security and repository controls

- Keep secrets out of source, commits, logs, documentation, and reports.
- Obtain approval before destructive database operations.
- Obtain explicit authorization before committing, pushing, or merging.
