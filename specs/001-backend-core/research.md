# Design decisions

| Decision | Rationale | Alternative considered |
| --- | --- | --- |
| Carry the in-progress implementation to a worktree based on the merged specification. | The existing files already cover the approved feature surface and include integration tests. | Rebuilding would discard working behavior and duplicate effort. |
| Keep application date validation and PostgreSQL enforcement and translate the known database rejection at the domain boundary. | The accepted business rule must hold even when the application and database clocks differ. | Relying on application validation alone would remove the tested persistence protection. |
| Retain the existing session store and project-name comparison approach, subject to verification. | Both already have regression coverage within the approved stack. | New storage or comparison mechanisms would add risk without an identified requirement. |
| Use the engineering documents as the permanent record. | The approved specification defines the change and the canonical documents supply wire and operational details. | A second contract or schema document would drift. |
