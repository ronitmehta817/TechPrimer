# Tech Primer — Commands Runbook

Quick reference for running the site locally and deploying to Cloudflare
Workers. All commands run from inside the `AllWeb/` directory unless
explicitly noted.

> Auth uses **Google OAuth** (Authorization Code flow), session is a
> 30-day HS256 JWT in an `HttpOnly; Secure; SameSite=Lax` cookie, and
> per-user data syncs to **Workers KV**. Deploy target is a single
> Cloudflare Worker at `tech-primer.ronitmehta817.workers.dev`.

---

## A. Prerequisites — Google Cloud Console (one-time, browser only)

No CLI, but you must do this **before** any of the commands below.

1. Go to <https://console.cloud.google.com> and create a project (e.g.
   `tech-primer`).
2. **APIs & Services → OAuth consent screen**: External, scopes
   `openid email profile`, add yourself as a Test user.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Web application:
   - Authorized JavaScript origins:
     - `https://tech-primer.ronitmehta817.workers.dev`
     - `http://localhost:8787`
   - Authorized redirect URIs:
     - `https://tech-primer.ronitmehta817.workers.dev/auth/callback`
     - `http://localhost:8787/auth/callback`
4. Copy the **Client ID** and **Client Secret** — you'll paste them in
   step B.

---

## B. First-time CLI setup (one-time per Cloudflare account)

```bash
cd AllWeb

# 1. Install wrangler + auth this machine to your Cloudflare account
npm install
npx wrangler login

# 2. Create both KV namespaces (production + preview for `wrangler dev`).
#    Each prints an `id`; paste the first into wrangler.toml's `id` and
#    the second into `preview_id`.
npm run kv:create
npm run kv:create:preview

# 3. Set the two true secrets (Wrangler will prompt for the value)
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET            # value: openssl rand -hex 32

# 4. Set GOOGLE_CLIENT_ID — pick ONE of:
#    (a) Uncomment the [vars] block in wrangler.toml and paste the value
#        (recommended; commits to source — fine, it's a public value), OR
#    (b) Set it as an env var via the CLI:
npx wrangler secret put GOOGLE_CLIENT_ID

# 5. Local dev secrets (gitignored, never committed)
cp .dev.vars.example .dev.vars
# then open AllWeb/.dev.vars and paste:
#   GOOGLE_CLIENT_ID=...
#   GOOGLE_CLIENT_SECRET=...
#   SESSION_SECRET=...   (use a separate `openssl rand -hex 32`)
```

After step B, your repo and Cloudflare account are fully wired. KV
namespaces and Worker secrets persist across deploys — you don't redo
them.

---

## C. Local development

Every time you want to work locally:

```bash
cd AllWeb
npm run dev
```

Wrangler serves on `http://localhost:8787`. Click the account button →
sign in with Google → you should bounce back signed-in. `Ctrl-C` to stop.

After a `git pull`:

```bash
npm install   # only if package.json or package-lock.json changed
```

> **Note:** Auth only works through `wrangler dev`, not through
> `python3 -m http.server` or any other plain static server, because
> those don't run the Worker handlers (`/auth/*`, `/api/*`).

---

## D. Production deploy

Every time you want to ship:

```bash
cd AllWeb
npm run deploy
```

That bundles `src/index.js`, uploads everything not matched by
`.assetsignore` as static assets, and atomically replaces the running
Worker at `https://tech-primer.ronitmehta817.workers.dev`. KV bindings
and secrets stay attached.

---

## E. Day-to-day operational commands

| Goal                                          | Command                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Live tail of production logs                  | `npm run tail`                                                                   |
| Confirm the active Cloudflare account         | `npx wrangler whoami`                                                            |
| List recent deploys                           | `npx wrangler deployments list`                                                  |
| Roll back to the previous deploy              | `npx wrangler rollback`                                                          |
| List which secrets are set on the Worker      | `npx wrangler secret list`                                                       |
| List all KV keys (sanity check)               | `npx wrangler kv key list --binding=USER_STORE`                                  |
| Read one user's KV blob (use `sub` from `/api/me`) | `npx wrangler kv key get --binding=USER_STORE "user:<google_sub>"`         |
| Delete one user's KV blob                     | `npx wrangler kv key delete --binding=USER_STORE "user:<google_sub>"`            |
| Rotate `SESSION_SECRET` (signs everyone out)  | `npx wrangler secret put SESSION_SECRET && npm run deploy`                       |
| Rotate Google client secret                   | `npx wrangler secret put GOOGLE_CLIENT_SECRET && npm run deploy`                 |

---

## F. Fresh clone on a different machine

Cloudflare-side state (KV namespace + Worker secrets) is already
provisioned, so you only redo the local bits:

```bash
cd AllWeb
npm install
cp .dev.vars.example .dev.vars     # then edit with real values
npx wrangler login                 # auth this new machine
npm run dev                        # local
# or
npm run deploy                     # ship to prod
```

You do **not** recreate KV namespaces or re-set production secrets —
they live on Cloudflare, not on disk.

---

## G. Operational reference

Everything below is generated by the Worker at runtime — no commands to
run, just reference material so you know what a 429 / 413 / 415 means
when you see one, and what each `wrangler tail` log line is telling you.

### G.1 Rate limits in effect

In-isolate sliding-window limits, applied by `src/index.js` before the
handler runs. Each isolate keeps its own counter (so the effective
global limit is roughly `limit × isolates serving your traffic`). For
production-grade global limits, configure **Cloudflare WAF Rate
Limiting Rules** at the dashboard.

| Endpoint            | Method | Key       | Limit         | On exceed                                    |
| ------------------- | ------ | --------- | ------------- | -------------------------------------------- |
| `/auth/login`       | GET    | client IP | 10 / minute   | 429 with `Retry-After`                       |
| `/auth/callback`    | GET    | client IP | 10 / minute   | 429 with `Retry-After`                       |
| `/auth/logout`      | GET    | client IP | 30 / minute   | 429 with `Retry-After`                       |
| `/api/me`           | GET    | client IP | 60 / minute   | 429 with `Retry-After`                       |
| `/api/store`        | GET    | session `sub` | 120 / minute | 429 with `Retry-After` (after session check) |
| `/api/store`        | PUT    | session `sub` |  60 / minute | 429 with `Retry-After` (after session check) |

The frontend (`Store._handleRateLimited` in `app.js`) honours
`Retry-After`: it pauses sync, runs a per-second countdown in the
account dropdown, and only resumes once the cooldown expires.

### G.2 Validation caps on `/api/store` PUT

Configured in `src/handlers/api.js`. Hitting any of these returns a 400
JSON envelope `{error: "<code>", message: "..."}` (or 413 for the byte
cap, 415 for wrong content type).

| Limit                              | Value           | HTTP code on breach |
| ---------------------------------- | --------------- | ------------------- |
| Total body (UTF-8 bytes)           | 256 KB          | 413 `body_too_large` |
| `Content-Type` header              | must be `application/json` | 415 `unsupported_media_type` |
| Bookmarks count                    | ≤ 1 000          | 400 `invalid_bookmarks` |
| Notes count                        | ≤ 500            | 400 `invalid_notes` |
| Single note value                  | ≤ 32 KB (UTF-8)  | 400 `invalid_notes` |
| Playlists count                    | ≤ 50             | 400 `invalid_playlists` |
| Items per playlist                 | ≤ 200            | 400 `invalid_playlists` |
| Bookmark / lastRead title          | ≤ 200 chars      | 400 `invalid_*` |
| Playlist item title                | ≤ 300 chars      | 400 `invalid_playlists` |
| Playlist name                      | ≤ 120 chars      | 400 `invalid_playlists` |
| `sid` (section id) length          | ≤ 120 chars      | 400 `invalid_*` |
| `chKey` / `c` / playlist id length | ≤ 200 chars      | 400 `invalid_*` |
| Top-level keys allowed             | `bookmarks`, `notes`, `playlists`, `lastRead`, `updatedAt` | 400 `unexpected_key` |

The frontend reads the `message` field of the JSON envelope and shows
it via `setSyncStatus("Sync failed: …")` inside the account dropdown.

### G.3 Structured log events (visible via `npm run tail`)

All logs are single-line JSON so `wrangler tail | jq` works cleanly.
They never contain cookies, JWTs, ID tokens, secrets, or user blob
contents — only event name, IP, user-agent prefix, and minimal context.

| Event                           | Source              | Meaning                                                |
| ------------------------------- | ------------------- | ------------------------------------------------------ |
| `sign_in`                       | `auth.js`           | Successful Google sign-in (`sub`, `email` logged)      |
| `sign_out`                      | `auth.js`           | User hit `/auth/logout`                                |
| `login_misconfigured`           | `auth.js`           | `GOOGLE_CLIENT_ID` env var missing                     |
| `callback_oauth_error`          | `auth.js`           | Google sent us `?error=…` (user denied, etc.)          |
| `callback_missing_params`       | `auth.js`           | Callback hit without `code` or `state` query           |
| `callback_missing_cookie`       | `auth.js`           | Browser dropped the `oauth_state`/`oauth_nonce` cookie |
| `callback_state_mismatch`       | `auth.js`           | `state` query ≠ state cookie (CSRF / replay)           |
| `callback_misconfigured`        | `auth.js`           | One or more OAuth/SESSION env vars missing             |
| `token_exchange_network_error`  | `auth.js`           | `fetch()` to Google token endpoint threw               |
| `token_exchange_http_error`     | `auth.js`           | Google returned non-2xx on token exchange              |
| `token_exchange_parse_error`    | `auth.js`           | Google's token response wasn't JSON                    |
| `token_exchange_no_id_token`    | `auth.js`           | Token response missing `id_token`                      |
| `id_token_invalid`              | `auth.js`           | RS256 / `iss` / `aud` / `exp` / JWKS check failed      |
| `nonce_mismatch`                | `auth.js`           | `id_token.nonce` ≠ nonce cookie (replay attempt)       |
| `missing_sub`                   | `auth.js`           | `id_token` had no `sub` claim                          |
| `session_sign_failed`           | `auth.js`           | Web Crypto threw while signing our session JWT         |
| `rate_limited`                  | `index.js`          | A request hit the limiter; includes `route` + `mode`   |
| `put_validation_failed`         | `api.js`            | A PUT body broke a cap or shape rule                   |
| `kv_get_failed` / `kv_put_failed` | `api.js`          | Workers KV throw on read/write                         |
| `kv_corrupt`                    | `api.js`            | KV returned non-object data; client got `{}` instead   |
| `handler error` (plain text + stack) | `index.js`     | Anything thrown inside a handler ended up here         |

### G.4 `?login_error=<code>` codes (auth callback failures)

When sign-in fails for any reason, the user lands back on `/` with this
query param set. The frontend (`app.js`) maps the code to a one-line
message and shows it inside the account dropdown; it strips the param
from the URL so a refresh doesn't re-trigger the message.

| Code                          | What happened                                                |
| ----------------------------- | ------------------------------------------------------------ |
| `oauth_access_denied`         | User clicked "Cancel" on Google's consent screen.            |
| `oauth_invalid_request`       | Malformed authorize request (config bug, usually).           |
| `oauth_unauthorized_client`   | OAuth client ID disabled or missing the right scopes.        |
| `oauth_unsupported_response_type` | We asked for a response type Google doesn't support.    |
| `oauth_invalid_scope`         | Requested scope not enabled on the OAuth client.             |
| `oauth_server_error`          | Google had an internal problem.                              |
| `oauth_temporarily_unavailable` | Google asked us to retry later.                            |
| `state_mismatch`              | State cookie didn't match query state — CSRF / replay /      |
|                               | the user took >10 min to complete consent.                   |
| `missing_state_cookie`        | Browser blocked or dropped the handshake cookies.            |
| `missing_params`              | Callback URL had no `code` or `state` (manual visit?).       |
| `nonce_mismatch`              | `id_token.nonce` didn't match the nonce cookie.              |
| `missing_sub`                 | Google's `id_token` had no `sub` claim (very rare).          |
| `token_exchange_failed`       | Couldn't exchange the auth code for tokens (network/Google). |
| `id_token_invalid`            | RS256 signature, audience, or expiry check failed.           |
| `session_sign_failed`         | Web Crypto failed while creating our session JWT.            |
| `not_configured`              | Worker is missing `GOOGLE_CLIENT_*` or `SESSION_SECRET`.     |

### G.5 Quick troubleshooting

| Symptom                                                      | Likely cause / fix                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Sign-in button does nothing on `python3 -m http.server` etc. | Auth needs `npm run dev` (Worker handlers). Static servers can't serve `/auth/*`.        |
| Sign-in works on Chrome but fails on Safari with `localhost` | Safari rejects `Secure` cookies on `http://`. Already mitigated — verify with `wrangler dev`. |
| `?login_error=state_mismatch` after consent                  | Took longer than 10 min on Google's screen, or new tab overrode the state cookie. Just retry. |
| `?login_error=not_configured`                                | Missing secrets. Re-check `npx wrangler secret list` and `[vars]` in `wrangler.toml`.    |
| 429 in DevTools Network tab on `/api/store`                  | Hit the per-`sub` rate limit. The dropdown shows a countdown; sync resumes after.        |
| 415 `unsupported_media_type` on PUT                          | Frontend sent something other than `Content-Type: application/json`. Should never happen — file a bug. |
| 413 `body_too_large` on PUT                                  | Your sync blob is over 256 KB. Inspect with the KV "read one user's blob" command.      |
| 400 `invalid_notes` on every sync                            | One note is over 32 KB. Edit it down or delete it locally; sync will recover.            |
| Sync stuck on "Syncing…"                                     | `/api/store` GET is failing. Check `wrangler tail` for `kv_get_failed`.                  |
| "Signed out (session expired)" appears mid-session           | Your session JWT was invalidated (30-day expiry, or `SESSION_SECRET` rotated). Just sign in again. |
| Browser console shows `Refused to load … CSP`                | Something tried to load a script/style/image from a host not in `_headers` CSP. Add it there. |

---

## TL;DR

```bash
# === FIRST TIME EVER (after Google Cloud Console step) ===
cd AllWeb
npm install
npx wrangler login
npm run kv:create                                # paste id into wrangler.toml
npm run kv:create:preview                        # paste preview_id into wrangler.toml
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET           # value: openssl rand -hex 32
npx wrangler secret put GOOGLE_CLIENT_ID         # OR uncomment [vars] in wrangler.toml
cp .dev.vars.example .dev.vars                   # then edit the file

# === EVERY TIME — LOCAL ===
npm run dev                                      # http://localhost:8787

# === EVERY TIME — PRODUCTION ===
npm run deploy
```
