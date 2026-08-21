# Bell429 Spare Parts — v40 Security & Stability Fix Pack

This package contains replacement backend files prepared against the current `zoro-om/bell429-spare-parts` main branch.

## Main fixes

1. Fixes the D1 bootstrap problem that can cause `/api/auth/setup` / login to fail with Cloudflare Worker error 1101.
2. Supports `ADMIN_USER` as the configured designer username.
3. Keeps `SETUP_TOKEN` as the one-time setup gate.
4. Keeps designer/supervisor passwords server-side and PBKDF2-hashed.
5. Keeps Secure + HttpOnly + SameSite=Strict session cookies.
6. Keeps CSRF validation for state-changing authenticated requests.
7. Adds server-side rate limiting for login, public order creation, and catalog search.
8. Adds a random bearer tracking token for every new order.
9. Stops public order lookup by ID alone; public tracking now requires both `id` and `token`.
10. Keeps full order listing behind server-side permissions.
11. Keeps deletion behind server-side permissions.
12. Keeps the raw `parts_index.json`, `.git`, source maps, and direct PDFs blocked by the existing middleware.
13. Keeps the existing security headers/CSP in the middleware.
14. Removes any need to put the designer password in browser JavaScript.

## Files

- `functions/_lib/schema.js`
- `functions/_lib/auth.js`
- `functions/api/auth/setup.js`
- `functions/api/orders.js`
- `functions/api/catalog.js`
- `migrations_v40_security.sql`

## Cloudflare setup

### 1. Secrets

In Cloudflare Pages > Settings > Variables and Secrets, keep:

- `ADMIN_USER` = the designer username you want
- `SETUP_TOKEN` = a long random setup token

Do NOT put the designer password in source code.

`ADMIN_PASSWORD` is optional in this pack. The normal setup flow accepts the password in the one-time setup request instead.

### 2. D1

The backend contains a self-healing schema bootstrap. It creates the required tables/indexes and adds `tracking_token_hash` if the existing `orders` table does not have it.

The SQL file is also included for a controlled/manual migration if you prefer to run D1 migrations from Cloudflare.

### 3. Deploy

Upload/commit these files to the repository and let the existing Cloudflare Pages Git deployment run.

Do not upload any private setup document or secret values.

### 4. One-time designer setup

Use the existing setup endpoint:

`POST /api/auth/setup`

Headers:

`Content-Type: application/json`

`X-Setup-Token: <SETUP_TOKEN>`

Body:

`{"username":"<ADMIN_USER>","password":"<NEW_PASSWORD>"}`

The endpoint returns:

- `201` = setup completed
- `400` = invalid username/password or username mismatch
- `404` = invalid setup token
- `409` = setup was already completed
- `503` = D1/backend unavailable

Do not run setup again after a designer user already exists.

### 5. Designer login

Open the site, use the designer login, and verify:

- login succeeds
- page reload keeps the authenticated session
- logout removes the session
- wrong password returns a generic error
- repeated failed attempts are rate limited

### 6. New order

Verify a normal public order can be created.

The response now includes a random `trackingToken`. The token is a bearer secret for that single order and must not be logged or displayed in public source code.

Public tracking must use:

`/api/orders?id=<ORDER_ID>&token=<TRACKING_TOKEN>`

An ID without the token must return `404`.

### 7. Security regression checks

Verify these URLs do NOT expose sensitive assets:

- `/.git/HEAD` -> 404
- `/parts_index.json` -> 404
- any `*.map` asset -> 404
- direct PDF assets -> 404

Verify the site response includes:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

## Credential rotation

The password that existed in the old client-side build must be considered compromised and must never be reused.

If a password has been pasted into a chat, screenshot, Git history, issue, or other shared location, rotate it before production use.

## Important

This package prepares the code fixes. It does not itself prove that the live Cloudflare deployment is secure. The final green status requires testing the deployed URL after Cloudflare finishes the build.
