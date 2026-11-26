# Package 01 data model

### Project

Uses the [approved Project fields](../../docs/REQUIREMENTS.md#approved-domain-model). `Project.id` uses the approved identity type, `Project.name` is required and unique ignoring case, and `Project.description` is optional and bounded. `Project.createdAt` and `Project.updatedAt` are timestamps with time zone.

### DevelopmentSession

Uses the [approved DevelopmentSession fields](../../docs/REQUIREMENTS.md#approved-domain-model). `DevelopmentSession.id` is an identity and `DevelopmentSession.projectId` references an existing project with restricted deletion. `DevelopmentSession.sessionDate` is a date and follows the Istanbul boundary. `DevelopmentSession.workSummary` is required and bounded. `DevelopmentSession.workFocus`, `DevelopmentSession.learningNotes`, `DevelopmentSession.difficulties` and `DevelopmentSession.nextSteps` are optional and bounded. `DevelopmentSession.createdAt` and `DevelopmentSession.updatedAt` are timestamps with time zone. [Database rules and limits](../../docs/DATABASE.md)

### Owner and transport session

`Owner.id` enforces the singleton, `Owner.username` identifies the owner and `Owner.passwordHash` stores the approved password hash. `HttpSession.sid` identifies the revocable session, `HttpSession.sess` holds server-side session data, and `HttpSession.expire` enforces the stored deadline. [Authentication design](../../docs/ARCHITECTURE.md#approved-authentication-design)
