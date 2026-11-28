# Implementation Plan — Package 01 Backend Core

**Branch** `codex/package-01-backend-core`
**Spec** [Approved Package 01](spec.md)

## Summary

Carry forward the existing Backend Core changes on the merged specification baseline. Verify each story through its normal entry point, close the date-guard regression and remaining coverage gaps, and publish the canonical API contract.

## Technical Context

Use the approved strict TypeScript, Node 26, Express 5, PostgreSQL, Prisma, Zod, Vitest and Supertest stack. Keep the existing adapter, session store and npm lockfile. Use a disposable PostgreSQL 18 database for integration checks.

## Constitution Check

- **Simplicity and maintainability** — Reuse repository, middleware and test boundaries. Keep date policy and persistence error translation in their existing domain modules. Review layer responsibilities against the approved architecture where logic changes.
- **Security** — Check owner provisioning, credential handling, safe failure responses, cookies, CSRF, transport and proxy configuration. Keep integration fixtures isolated from live data.
- **Verification** — Test migration and seed reruns, session persistence and expiry, concurrent data integrity, the Istanbul boundary and database rejection on create and update. Require the existing CI job to pass.
- **Oversight and documentation** — Keep approved scope and public foundation behavior. Define the first Package 01 wire contract in the existing API document. Record evidence and submit the change for human review.

The design review found no constitution exceptions or material changes requiring prior approval.

## Project Structure

Keep HTTP handling under `backend/src/`, persistence under the existing domain and Prisma paths, and integration checks under `backend/test/`. Update the approved engineering documents with implemented behavior and evidence.

## Delivery order

Complete provisioning and authentication verification, then Projects, then session writes and date validation, then filtered history. Finish canonical documentation and verify clean installation, the full suite and CI. [Research](research.md) · [Data model](data-model.md) · [Contract scope](contracts/api.md) · [Verification quickstart](quickstart.md)
