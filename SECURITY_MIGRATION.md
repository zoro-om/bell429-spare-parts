# Bell 429 security migration

This package is the server-side hardening layer. It is intentionally separated from the existing UI so the current site can be backed up before migration.

## Files

- `wrangler.jsonc` — Cloudflare Worker + D1 configuration.
- `src/worker.js` — authenticated API/session layer.
- `migrations/0001_security.sql` — users, sessions and audit tables.
- `tools/hash-password.mjs` — generates a PBKDF2 password record.
- `_headers` — baseline security headers for Pages.

## Critical actions before publishing

1. **Change every password that was previously present in `index.html`.**
   Treat those passwords as compromised.
2. Create a D1 database and put its ID in `wrangler.jsonc`.
3. Run the SQL migration.
4. Create the initial designer/supervisor records using password hashes only.
5. Replace the existing browser-only authentication with `/api/auth/login`.
6. Remove all hard-coded credentials from `index.html`.
7. Remove password values and authorization state from `localStorage`.
8. Point order reads/writes at the authenticated Worker API.
9. Set `ALLOWED_ORIGIN` in `src/worker.js` to the exact production origin.
10. Test unauthorized GET/POST/PUT/DELETE requests before making the repository private again.

## Important

This package cannot safely claim to be a drop-in replacement for the existing `index.html` without the complete UI source and exact order schema being migrated. The Worker deliberately returns `501` for unspecified order-write mappings rather than guessing and risking data loss.
