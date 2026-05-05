# Tech Primer — Google login + cross-device sync (Cloudflare Workers)

Adds "Sign in with Google" to this static site. Bookmarks, notes, study
playlists and last-read state sync to **Workers KV** keyed by the Google
`sub` claim, so signing in with the same Google account in any browser
pulls the same data.

Stays on the **Cloudflare free tier** — Workers (100 k requests/day,
10 ms CPU per invocation, 1 MB bundle), KV (100 k reads/day, 1 k
writes/day, 1 GB), Google OAuth (free). Plenty for personal use.

Signed-OUT visitors keep working exactly like before — sign-in is purely
additive.

The site keeps its existing URL `tech-primer.ronitmehta817.workers.dev`.

---

## Architecture

A single Worker (`src/index.js`) handles `/auth/*` and `/api/*`. Anything
else falls through to the Static Assets binding which serves the original
files unchanged.

```
                                +------------------------+
   +---------+ /auth/login -->  | src/handlers/auth.js   |
   | Browser |                  | handleLogin            |
   |         | <-- 302 Google -- | sets oauth_state cookie|
   +---------+                  +------------------------+
        |
        v
  Google OAuth consent
        |
        v
   +---------+ /auth/callback?code +-----------------------+
   | Browser | ------------------> | handleCallback        |
   |         |                     | verify state + nonce  |
   |         |                     | exchange code         |
   |         | <-- Set-Cookie -----| verify id_token vs    |
   +---------+    session=...      | Google JWKS           |
                                   | sign HS256 session JWT|
                                   +-----------------------+

   Browser ---/api/me-->     handleMe         -> { sub, email, name, picture }
   Browser ---/api/store-->  handleStoreGet/Put -> KV: user:{sub}
   Browser ---/auth/logout-> handleLogout (clears cookie)
   Anything else             -> env.ASSETS.fetch(request)  (static site)
```

Session JWT (HS256, 30-day) lives in an `HttpOnly; Secure; SameSite=Lax`
cookie. KV key is `user:{sub}`, value is one JSON document containing
bookmarks/notes/playlists/last-read.

File layout:

```
AllWeb/
├── wrangler.toml          # Worker config
├── .assetsignore          # excludes src/, wrangler.toml etc. from upload
├── package.json           # dev dep: wrangler
├── _headers               # Cache-Control rules for static assets
├── index.html             # static site root
├── app.js / styles.css / content.js / vendor.js / ...
└── src/
    ├── index.js           # Worker entry + router
    ├── lib/
    │   ├── session.js     # HS256 sign/verify, cookie helpers
    │   └── google.js      # ID token verification via Google JWKS
    └── handlers/
        ├── auth.js        # handleLogin / handleCallback / handleLogout
        └── api.js         # handleMe / handleStoreGet / handleStorePut
```

---

## One-time setup

You'll do this in three places: Google Cloud Console, Cloudflare, and
your local machine. Total time: ~15 min.

### 1. Google Cloud Console

1. Go to <https://console.cloud.google.com> and create a new project
   (e.g. `tech-primer`).
2. **APIs & Services → OAuth consent screen**
   - User type: **External**.
   - App name: `Tech Primer` (or whatever).
   - User support email: your email.
   - Developer contact: your email.
   - Scopes: add **openid**, **email**, **profile**.
   - Test users: add your own Google account email (and any others you
     want signed in while the app is in *Testing* state).
   - Save. You can publish later to remove the "Testing" warning.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**.
   - Name: `tech-primer-web`.
   - Authorized JavaScript origins:
     - `https://tech-primer.ronitmehta817.workers.dev`
     - `http://localhost:8787`
   - Authorized redirect URIs:
     - `https://tech-primer.ronitmehta817.workers.dev/auth/callback`
     - `http://localhost:8787/auth/callback`
   - Save. Copy the **Client ID** and **Client Secret**.

### 2. Cloudflare Workers (CLI)

From this directory (`AllWeb/`):

```bash
# Install wrangler the first time
npm install

# Authenticate
npx wrangler login

# Create the production KV namespace, copy the printed `id`
npx wrangler kv namespace create USER_STORE

# Create the preview KV namespace (for `wrangler dev`), copy the `id`
npx wrangler kv namespace create USER_STORE --preview
```

Edit [`wrangler.toml`](wrangler.toml) and replace the two
`REPLACE_WITH_KV_*` placeholders under `[[kv_namespaces]]` with the IDs
you just copied.

Set the secrets and the public client ID:

```bash
# Secrets — wrangler will prompt for the value, paste and hit Enter
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET     # use: openssl rand -hex 32

# Public client id — either set as a [vars] entry in wrangler.toml or
# upload as a non-secret env var via the dashboard
npx wrangler secret put GOOGLE_CLIENT_ID   # OK to use `secret put`; treated as env var either way
```

Generate `SESSION_SECRET` with:

```bash
openssl rand -hex 32
```

### 3. Local development

```bash
# Copy the example env file and fill in your values
cp .dev.vars.example .dev.vars
# Edit .dev.vars: paste GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and any
# random hex string for SESSION_SECRET (local-only; doesn't need to
# match production).

# Run the local dev server (uses preview KV namespace)
npm run dev
```

Open <http://localhost:8787>. Click the account button in the header,
sign in with Google. The OAuth client must have `http://localhost:8787`
in its Authorized JavaScript origins and
`http://localhost:8787/auth/callback` in Authorized redirect URIs (see
step 1).

### 4. Deploy

```bash
npm run deploy
```

That bundles `src/index.js`, uploads everything not matched by
`.assetsignore` as static assets, and ships the new Worker. The old
deployment is replaced atomically — the URL stays
`tech-primer.ronitmehta817.workers.dev`.

---

## How sync works (so it's easy to debug)

- Every signed-in write to `Store.setLastRead`, `Store.toggleBookmark`,
  `Store.setNotes`, or `Store.savePlaylists` schedules a debounced
  ~1.5 s `PUT /api/store` with the entire blob.
- localStorage keys are namespaced when signed in:
  `tp-u:<google_sub>:bookmarks`, etc. Signed-out visitors keep using the
  legacy `tp-bookmarks` etc. — so signing out doesn't lose data.
- On first sign-in we **merge** the legacy local data with whatever is
  on the server (last-write-wins per entry, by `t` timestamp), then push
  the merged blob back so both sides agree.
- On returning sign-in (existing per-user prefix), we merge the per-user
  prefix data with the server.
- Cross-tab sync within the same browser is via the `storage` event.
- Cross-device sync requires a refresh on the second device (no live
  channel — WebSockets/SSE are out of scope for the free tier).
- Body cap on `PUT /api/store`: 256 KB. Plenty for thousands of
  bookmarks + notes.

---

## Operations

### Tail logs

```bash
npm run tail
```

### Look at someone's stored blob

```bash
npx wrangler kv key get --binding=USER_STORE "user:<google_sub>"
```

You can find a user's `sub` by signing in and hitting `/api/me` in
DevTools, or by base64url-decoding the middle segment of the `session`
cookie.

### Rotate `SESSION_SECRET`

Anyone holding a session JWT signed with the old secret will be silently
signed out the next time they hit the site (signature won't verify).

```bash
npx wrangler secret put SESSION_SECRET
# paste a new `openssl rand -hex 32` value and redeploy
npm run deploy
```

### Debug a 401 on `/api/store`

The session cookie is `HttpOnly`, so DevTools console can't see it but
the Network tab shows it under Cookies. Most common cause: cookie
expired (30 days) or `SESSION_SECRET` changed since the cookie was
issued. Sign in again.

### Bundle size budget

The Worker free tier caps the gzipped bundle at 1 MB. Our entire
`src/` is well under 100 KB and has no third-party deps; we have plenty
of headroom.

---

## What's NOT in here

- Polling / SSE / WebSockets for real-time cross-device sync. Refresh
  the second device to pick up changes.
- Server-side rate limiting. Cloudflare's edge already absorbs abuse;
  if you outgrow that, add a `cf.cacheTtl` + KV-backed limiter.
- An admin page to delete a user's data. Use `wrangler kv key delete`.
- Per-device sign-out (revoking just one session). The session JWT is
  stateless; only `SESSION_SECRET` rotation kills all sessions at once.
