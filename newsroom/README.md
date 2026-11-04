# Institutional storage domain prototype

Internal development proof only. Not connected to the live site or an HTTP server.

Implemented and tested: tenant-bound membership checks, owner/editor/reviewer/viewer distinctions, versioned JSON files, optimistic save conflict detection, audit rows, SQLite backup/restore test, and cross-tenant denial even with a known file ID.

Not implemented: authentication, enrollment, session/CSRF controls, invitation delivery, HTTP endpoints, file attachments/object storage, signed grants, editor save callbacks and SSRF defenses, CRDT collaboration, durable deployment, operational backups/restore drills, encryption key management, retention/deletion policy and production audit integrity. The audit table is not tamper-proof.

`principal` must come from a future verified authentication adapter, not a client's request-body user ID. `bootstrap` is administrative provisioning, not a public signup route. Do not expose this prototype to the internet.

Run: `python3 -m unittest tests/test_newsroom_store.py -v`
