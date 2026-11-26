# Verification quickstart

Use Node 26.13.1, npm and a dedicated disposable PostgreSQL 18 database named `devtrail_test_*`. Set `TEST_DATABASE_URL` through the process environment. The integration suite applies migrations in a fresh schema and uses generated fixture credentials. [Backend setup](../../README.md#backend-setup-and-development)

From `backend/` run:

```sh
npm ci
npm run db:validate
npm run typecheck
npm test
npm run test:db
npm run build
```

Expect all checks to pass, including owner lifecycle, unique and foreign-key constraints, filtered pages, Istanbul midnight and database rejection on create and update. See [acceptance scenarios](spec.md#user-scenarios--testing).
