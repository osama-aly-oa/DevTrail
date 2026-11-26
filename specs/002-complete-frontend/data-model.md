# Frontend Data Model

| Data | Representation and ownership |
| --- | --- |
| Owner session | The server owns the session and cookie. Redux stores the current public owner, expiry, and an in-memory request-protection token for the loaded page. |
| Project and development session | Consume the [canonical response shapes](../../docs/API.md#approved-conventions) and preserve decimal IDs as strings. |
| Editable forms | Local strings and per-field errors. Trim domain text, enforce [Unicode code-point limits](../../docs/DATABASE.md#selected-text-limits), and send null for blank optional text. |
| Calendar date | Gregorian `YYYY-MM-DD`. Session writes require an existing project and a date no later than today in Europe/Istanbul. |
| List state | Applied filters and offset are URL parameters. Page data stays local and uses the server's `hasMore` flag. |
