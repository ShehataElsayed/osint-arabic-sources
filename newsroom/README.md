# Institutional storage domain prototype

Internal development proof only. Not connected to the live site or an HTTP server.

Implemented and tested: tenant-bound membership checks, owner/editor/reviewer/viewer distinctions, versioned JSON files, optimistic save conflict detection, audit rows, version-bound draft/review/approval/changes-requested states with separate-author review and automatic approval invalidation on edit, SQLite backup/restore test, and cross-tenant denial even with a known file ID.

Not implemented: authentication, enrollment, session/CSRF controls, invitation delivery, HTTP endpoints, file attachments/object storage, signed grants, editor save callbacks and SSRF defenses, CRDT collaboration, durable deployment, operational backups/restore drills, encryption key management, retention/deletion policy and production audit integrity. The audit table is not tamper-proof.

`principal` must come from a future verified authentication adapter, not a client's request-body user ID. `bootstrap` is administrative provisioning, not a public signup route. Do not expose this prototype to the internet.

Run: `python3 -m unittest tests/test_newsroom_store.py -v`

Editorial approval is an internal version-bound decision, not authorization or implementation of external publication. Legacy files created before workflow support require a future migration before editorial transitions.

`access-auth.mjs` is a separate, unconnected authentication-adapter experiment. It pins issuer/audience from deployment configuration, requires a verified RS256 signature, rejects token-selected key URLs, expires identities, and returns issuer+subject rather than trusting an email or request-body user. Four local cryptographic tests cover negative paths. It has no production key cache/rate limiting, live IdP test, HTTP/CSRF adapter, or deployment. These tests do not authenticate anyone on the live site. Production should use a maintained provider verifier and independent security review. Reference: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/ .
