# DevTrail — AI Agent Instructions

## Project Overview

DevTrail is a developer journey and engineering reflection platform.

The project is also an educational Software Engineering exercise.

## Tech Stack

- Backend: Node.js, Express 5, TypeScript
- Database: PostgreSQL, Prisma
- Validation: Zod
- Testing: Vitest, Supertest
- Frontend: React, TypeScript, Vite
- Frontend libraries: React Router, Tailwind CSS, Axios, Redux Toolkit
- Package Manager: npm

## Architecture

- Traditional Layered Monolith
- Controllers, Services, Repositories
- Centralized error handling
- REST API with /api/v1 prefix

## Engineering Rules

- Follow the approved architecture.
- Prefer simple, maintainable solutions.
- Do not introduce unnecessary dependencies.
- Do not implement features outside the assigned task.
- Do not modify unrelated files.
- Never hardcode or commit secrets.
- Do not introduce JWT authentication; the MVP uses server-side sessions.
- Do not use RTK Query for the MVP.

## AI Collaboration

- Explain important technical decisions.
- Preserve opportunities for developer learning.
- Work incrementally.
- Review existing code before making changes.
- Never assume generated code is correct.
- Run relevant verification commands when possible.
- Report any verification steps that could not be completed.
- Do not create Git commits unless explicitly requested.

## Current Development Scope

Milestone M1: Project Foundation.

F01: Repository initialization completed.
F02: Backend Bootstrap — current task.

Do not implement database migrations, authentication, or frontend functionality during F02.
