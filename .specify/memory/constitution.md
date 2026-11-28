# DevTrail Constitution

## Core Principles

### I. Meaningful Simplicity & Product Quality

Simplify unnecessary complexity without sacrificing useful functionality, visual quality, usability, or product value.

Reuse existing components and justify new abstractions and dependencies through concrete requirements.

Simplicity must not be interpreted as removing valuable features or excessively simplifying the user experience.

### II. Maintainable Architecture and Clean Code

Preserve the approved layered monolith, stack, and public contracts. Put behavior in the
layer that owns it and keep code readable and testable. Explain any proposed material
departure from the approved design and obtain human approval before implementing it.

### III. Security by Default

Validate untrusted input at system boundaries, enforce authentication on protected routes,
and preserve approved session and CSRF protections. Use least privilege, enforce data
integrity where it belongs, and keep secrets out of the repository, logs, and verification
evidence. Identify security-sensitive changes and their failure cases in the plan.

### IV. Automated Tests and Verified Implementation

Define observable acceptance criteria and test requirements in the feature specification.
Include relevant automated tests for changed behavior and regressions in the plan and tasks. Run the relevant checks in the README and existing CI
workflow, including PostgreSQL integration tests when applicable. Report the results and
any checks that failed or could not run.

### V. Human-Led Engineering & AI-Assisted Implementation

Humans own product requirements, specifications, architectural decisions, technical planning, and acceptance criteria.

AI agents assist with repository analysis, technical research, task decomposition, implementation, testing, and documentation.

Specification, clarification, and planning artifacts must receive explicit human approval before progressing to the next respective stage.

AI agents must not silently redefine approved requirements or engineering decisions.

The primary responsibility of AI coding agents is to implement and verify human-approved engineering decisions.

### VI. Minimal Documentation

Keep feature artifacts focused on the proposed change, acceptance criteria, and decisions
needed to deliver it. Link to approved requirements and design instead of copying them.
Update the relevant source of truth when an approved decision or verified implementation
status changes.

## Sources of Truth

[Requirements](../../docs/REQUIREMENTS.md) govern product scope and domain rules.
[Architecture](../../docs/ARCHITECTURE.md), [Database](../../docs/DATABASE.md), and
[API](../../docs/API.md) govern design and contracts. Use the [Roadmap](../../docs/ROADMAP.md)
to select approved work and the [README](../../README.md) for development and verification
commands.

## Development Workflow

Use the [Spec Kit workflow](../../README.md#spec-driven-development) for new feature work
and material changes. Use the plan's Constitution Check to record applicable principles,
verification, and any approved deviations. Resolve conflicts with approved sources before
implementing the affected change.

## Governance

Review the constitution and verification evidence with each applicable pull request.
Amend the constitution through a human-approved pull request. Bump the major version
for incompatible governance changes, the minor version for new or expanded principles,
and the patch version for clarifications. Review affected workflow documentation and
templates with each amendment.

**Version** 2.0.0 | **Ratified** 2026-11-26 | **Last Amended** 2026-11-28
