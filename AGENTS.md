# DevTrail — Engineering Instructions

Humans own product requirements, specifications, architectural decisions, technical planning, and acceptance criteria. AI agents assist with analysis, research, task decomposition, implementation, testing, and documentation. Their primary responsibility is to implement and verify human-approved decisions. Preserve working behavior and keep changes within the assigned scope.

## Sources of truth

- [Requirements](docs/REQUIREMENTS.md) defines the product scope and domain rules.
- [Architecture](docs/ARCHITECTURE.md), [Database](docs/DATABASE.md), and [API](docs/API.md) define the approved system design and track implementation decisions.
- [Roadmap](docs/ROADMAP.md) organizes delivery and records foundation verification.
- [README](README.md) describes how to run and verify the current checkout. Use npm for backend scripts and dependency management.

## Engineering workflow

- Use the [Spec Kit workflow](README.md#spec-driven-development) and [constitution](.specify/memory/constitution.md) for new features and material changes. Link to the approved sources above from feature artifacts. Obtain explicit human approval of the specification, any clarification artifacts, and the planning artifacts before advancing from each respective stage.
- Inspect relevant code, tests, and documentation before making changes.
- Prefer complete features and coherent delivery packages. Work in reviewable increments and explain decisions that affect behavior or maintenance.
- Follow approved requirements and engineering decisions. Surface any proposed redefinition for human review. Make routine implementation decisions independently. Request approval before materially changing architecture, the technology stack, business requirements, or public API contracts.
- Remove unnecessary complexity while preserving useful functionality, visual quality, usability, and product value. Reuse existing components and justify new abstractions and dependencies through concrete requirements.
- Add appropriate automated tests alongside features. Run the relevant verification commands before reporting completion, record the evidence, and identify any gaps, security risks, or technical debt.
- Keep documentation synchronized with implementation. Identify which decisions are approved, which details are planned, and which behavior has been implemented and verified.

## Security and repository controls

- Keep secrets out of source, commits, logs, documentation, and reports.
- Obtain approval before destructive database operations.
- Obtain explicit authorization before committing, pushing, or merging.
