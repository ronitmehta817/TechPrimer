You are implementing Google login + cross-device sync for a static
educational site. This repo IS the site — all source files live at the
repo root. Read the existing code first (especially `index.html`,
`app.js`, and `_headers`) before writing anything.

=========================================================
GOAL
=========================================================
Add "Sign in with Google" to the site. After signing in, a user's
bookmarks, notes, study playlists, and last-read state must persist
server-side keyed by their Google account. Signing in with the same
Google account in a different browser, device, or incognito session must
show the same bookmarks/notes/playlists/last-read.

Signed-OUT users must keep working exactly like today — no regressions,
no loss of existing localStorage data.

Everything must run on the Cloudflare free tier:
- Cloudflare Workers + Static Assets binding (free: 100k requests/day,
  10ms CPU per invocation, 1 MB bundle)
- Workers KV free tier (100k reads/day, 1k writes/day, 1 GB)
- Google OAuth (free)

=========================================================
PLATFORM CHOICE: WORKERS (NOT PAGES)
=========================================================
The site is currently deployed on Cloudflare Workers
(`tech-primer.ronitmehta817.workers.dev`). We are KEEPING it on Workers
so the URL doesn't change. We will:
- Add a `wrangler.toml` so the deployment is reproducible from the repo.
- Use the Workers Static Assets binding to serve all current static files.
- Add a tiny hand-rolled router in `src/index.js` that handles
  `/auth/*` and `/api/*` and falls through to static assets for
  everything else.

DO NOT introduce Hono, itty-router, or any router library. Five routes
are not enough to justify a dependency. Keep the project dependency-light:
the only npm package added is `wrangler` (devDependency).

=========================================================
CURRENT STATE (verify by reading the files)
=========================================================
- This repo is a pure static site. No `package.json`, no `wrangler.toml`,
  no `src/`, no build step. Static files live at the repo root
  (`index.html`, `app.js`, `styles.css`, `content.js`, `vendor.js`,
  `three-bg.js`, `three-welcome.js`, `question-sections.js`,
  `manifest.json`, `robots.txt`, `sitemap.xml`, `_headers`).
- It is currently deployed on Cloudflare Workers (`*.workers.dev`).
  The OG tag in `index.html` line 18 confirms this.
- `app.js` already has a `Store` abstraction (around line 178) that
  wraps `localStorage` with a `STORAGE_PFX` prefix and methods like
  `getBookmarks`, `toggleBookmark`, `getNotes`, etc. Every persisted
  entry already carries a `t: Date.now()` timestamp — reuse this for
  last-write-wins merge.
- `_headers` works with Workers Static Assets (Cloudflare honours it).
  Keep it; just add new rules for /auth/* and /api/*.

=========================================================
ARCHITECTURE
=========================================================
OAuth: Authorization Code flow, server-side, with `state` cookie protection.

  Browser  ─GET /auth/login─►   Worker (handleLogin)
                                 │ generates random state + nonce, sets
                                 │ HttpOnly cookies, 302s to
                                 ▼
                               Google OAuth
                                 │
                                 ▼
  Browser  ◄─302 ?code&state─   Worker (handleCallback)
                                 │ verifies state cookie matches
                                 │ POSTs code to oauth2.googleapis.com/token
                                 │ verifies id_token against Google JWKS
                                 │ extracts { sub, email, name, picture }
                                 │ signs HS256 session JWT, sets cookie
                                 │ 302 to return_to (default '/')

  Browser  ─GET /api/me─►       Worker (handleMe)
  Browser  ─GET/PUT /api/store─►Worker (handleStore)
  Browser  ─GET /auth/logout─►  Worker (handleLogout)

  Anything else                 Worker → env.ASSETS.fetch(request)

Single Worker entry: `src/index.js` with one `URL`-pathname switch.
No router library.

Session cookie:
  Name:     `session`
  Value:    HS256 JWT signed with SESSION_SECRET, payload
            { sub, email, name, picture, iat, exp }, 30-day expiry
  Flags:    HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000

State / nonce cookies (during OAuth handshake only, 10-min TTL):
  Names:    `oauth_state`, `oauth_nonce`
  Flags:    HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600

KV binding: `USER_STORE`, key `user:{sub}`, value JSON:
  {
    "bookmarks": { "<chapterKey>": { "title": "...", "sid": "...", "t": <ms> } },
    "notes":     { "<chapterKey>": "markdown text" },
    "playlists": [ { "id": "...", "name": "...", "items": [...], "t": <ms> } ],
    "lastRead":  { "s": "<sid>", "c": "<cid>", "t": <ms> },
    "updatedAt": <ms>
  }
PUT body capped at 256 KB; reject larger with 413.

=========================================================
DELIVERABLES (files to create / modify, all paths repo-relative)
=========================================================

CREATE  wrangler.toml
   name = "tech-primer"
   main = "src/index.js"
   compatibility_date = "2024-12-01"
   # compatibility_flags = ["nodejs_compat"]   # only if strictly needed; aim NOT to need it

   [assets]
   directory = "./"
   binding = "ASSETS"
   not_found_handling = "single-page-application"   # falls back to /index.html for unknown paths
   # Files matched by .assetsignore are excluded from the asset upload.

   [[kv_namespaces]]
   binding = "USER_STORE"
   id = "<filled in via dashboard or `wrangler kv namespace create USER_STORE`>"
   preview_id = "<for `wrangler dev`>"

   # vars / secrets are set via `wrangler secret put` or the dashboard.
   # GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET

   [observability]
   enabled = true

CREATE  .assetsignore
   src/
   wrangler.toml
   .assetsignore
   .dev.vars
   .dev.vars.example
   .wrangler/
   node_modules/
   package.json
   package-lock.json
   README-AUTH.md
   .gitignore
   .git/

CREATE  package.json
   {
     "name": "tech-primer",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "wrangler dev",
       "deploy": "wrangler deploy",
       "kv:create": "wrangler kv namespace create USER_STORE",
       "tail": "wrangler tail"
     },
     "devDependencies": {
       "wrangler": "^3.0.0"
     }
   }
   (Pin `wrangler` to whatever the latest 3.x is when you implement.)

CREATE  .gitignore
   .dev.vars
   .wrangler/
   node_modules/
   .DS_Store

CREATE  .dev.vars.example
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   SESSION_SECRET=

CREATE  src/index.js
   The single Worker entry. Hand-rolled router. Outline:

     import { handleLogin, handleCallback, handleLogout } from './handlers/auth.js';
     import { handleMe, handleStoreGet, handleStorePut } from './handlers/api.js';

     const NO_STORE = { 'Cache-Control': 'no-store' };

     function methodNotAllowed(allow) {
       return new Response('Method Not Allowed', {
         status: 405,
         headers: { Allow: allow, ...NO_STORE },
       });
     }

     export default {
       async fetch(request, env, ctx) {
         const url = new URL(request.url);
         const { pathname } = url;
         const m = request.method;

         try {
           if (pathname === '/auth/login') {
             if (m === 'GET') return await handleLogin(request, env);
             return methodNotAllowed('GET');
           }
           if (pathname === '/auth/callback') {
             if (m === 'GET') return await handleCallback(request, env);
             return methodNotAllowed('GET');
           }
           if (pathname === '/auth/logout') {
             if (m === 'GET') return await handleLogout(request, env);
             return methodNotAllowed('GET');
           }
           if (pathname === '/api/me') {
             if (m === 'GET') return await handleMe(request, env);
             return methodNotAllowed('GET');
           }
           if (pathname === '/api/store') {
             if (m === 'GET') return await handleStoreGet(request, env);
             if (m === 'PUT') return await handleStorePut(request, env);
             return methodNotAllowed('GET, PUT');
           }
         } catch (err) {
           console.error('handler error', err && err.stack || err);
           return new Response('Internal Error', { status: 500, headers: NO_STORE });
         }

         // Fall through: static assets (handles /, /index.html, /app.js, etc.)
         return env.ASSETS.fetch(request);
       },
     };

CREATE  src/lib/session.js
   Pure ESM. Uses Web Crypto only. Exports:
     - signSession(payload, secret, ttlSeconds=2592000)
         HS256 JWT { ...payload, iat, exp }
     - verifySession(jwt, secret)
         returns payload or null (also returns null if exp <= now)
     - serializeCookie(name, value, opts)
         opts: { httpOnly, secure, sameSite, path, maxAge, domain }
     - parseCookies(cookieHeader) -> { name: value }
     - constantTimeEqual(a, b) -> boolean
     - randomHex(byteCount) using crypto.getRandomValues
     - getSessionFromRequest(request, env) -> payload or null

CREATE  src/lib/google.js
   Pure ESM. Exports:
     - verifyIdToken(idToken, expectedAudience)
       Fetches https://www.googleapis.com/oauth2/v3/certs (Google JWKS),
       caches the keys + expiry in module scope, respecting the
       `Cache-Control: max-age=...` of the JWKS response (fallback 1h).
       Verifies RS256 signature, iss in
       ['https://accounts.google.com', 'accounts.google.com'], aud, exp.
       Returns the verified payload.

CREATE  src/handlers/auth.js
   Exports `handleLogin`, `handleCallback`, `handleLogout`.

   handleLogin(request, env):
     - Parse `?return_to`; sanitize to a same-origin path. Default '/'.
     - Generate state = randomHex(32), nonce = randomHex(32).
     - Build authorize URL:
         https://accounts.google.com/o/oauth2/v2/auth
           ?client_id=<env.GOOGLE_CLIENT_ID>
           &redirect_uri=<origin>/auth/callback
           &response_type=code
           &scope=openid%20email%20profile
           &state=<state>
           &nonce=<nonce>
           &prompt=select_account
           &access_type=online
     - Stash return_to inside the state cookie value as
         `<state>.<base64url(return_to)>`
       so the callback can read it without a server-side store.
     - Return 302 with `Location` set, plus Set-Cookie headers for
       `oauth_state` and `oauth_nonce`. Do NOT clobber an existing valid
       `session` cookie.

   handleCallback(request, env):
     - Read `code`, `state`, `error` from query.
     - If error → 302 to `/?login_error=<error>` with Cache-Control: no-store.
     - Read oauth_state cookie, split into <state>.<base64url(return_to)>.
     - constantTimeEqual(query.state, cookie.state). On mismatch → 400.
     - POST to https://oauth2.googleapis.com/token with
       application/x-www-form-urlencoded body:
         code, client_id, client_secret, redirect_uri, grant_type=authorization_code
     - verifyIdToken(id_token, env.GOOGLE_CLIENT_ID).
     - Verify nonce in id_token matches oauth_nonce cookie.
     - signSession({ sub, email, name, picture }, env.SESSION_SECRET, 2592000).
     - Decode return_to from base64url; sanitize again (must start with '/').
     - 302 to return_to with:
         Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Lax;
                     Path=/; Max-Age=2592000
         Set-Cookie: oauth_state=; Max-Age=0; ...
         Set-Cookie: oauth_nonce=; Max-Age=0; ...
         Cache-Control: no-store

   handleLogout(request, env):
     - 302 to '/' with:
         Set-Cookie: session=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/
         Cache-Control: no-store

CREATE  src/handlers/api.js
   Exports `handleMe`, `handleStoreGet`, `handleStorePut`.

   handleMe(request, env):
     - getSessionFromRequest. If null → 401 JSON `{ "error": "unauthorized" }`,
       Cache-Control: no-store.
     - Else → 200 JSON { sub, email, name, picture }, Cache-Control: no-store.

   handleStoreGet(request, env):
     - require session, else 401.
     - data = await env.USER_STORE.get(`user:${sub}`, 'json')
     - return 200 JSON (data || {}), Cache-Control: no-store.

   handleStorePut(request, env):
     - require session, else 401.
     - read raw body as text; if length > 262144 → 413.
     - JSON.parse; on parse error → 400.
     - Validate top-level keys subset of
         { bookmarks, notes, playlists, lastRead, updatedAt }
       and that values match expected types (objects/array). Reject 400 on shape mismatch.
     - body.updatedAt = Date.now()
     - await env.USER_STORE.put(`user:${sub}`, JSON.stringify(body))
     - return 200 JSON { updatedAt: body.updatedAt }, Cache-Control: no-store.

MODIFY  _headers
   Add at the TOP (before existing rules):
     /auth/*
       Cache-Control: no-store
     /api/*
       Cache-Control: no-store

MODIFY  index.html
   - Update line 18 `og:url` to the deployed Worker URL (keep
     `https://tech-primer.ronitmehta817.workers.dev/` if that stays the
     production URL; replace with your custom domain if applicable).
   - Insert a new account button + dropdown into the `.header-right` group
     (between `#btn-preferences` and `#theme-toggle`):

     <button class="header-btn" id="btn-account" aria-label="Account"
             title="Sign in"> ... avatar/person SVG ... </button>
     <div class="account-dropdown" id="account-dropdown" hidden>
       <!-- populated by app.js when signed in -->
     </div>

MODIFY  app.js
   1) Add an `Auth` module near the top of the IIFE (just above `Store`):

      var Auth = {
        user: null,                  // { sub, email, name, picture } | null
        listeners: [],
        async load() {
          try {
            var r = await fetch('/api/me', { credentials: 'same-origin' });
            this.user = r.ok ? await r.json() : null;
          } catch (_) { this.user = null; }
          this.listeners.forEach(function(fn){ try { fn(); } catch(_){} });
          return this.user;
        },
        onChange(fn) { this.listeners.push(fn); },
        signIn() {
          var rt = encodeURIComponent(location.pathname + location.search + location.hash);
          location.href = '/auth/login?return_to=' + rt;
        },
        signOut() { location.href = '/auth/logout'; },
      };

   2) Refactor `Store` to be sync-aware while preserving its public API
      (`getBookmarks`, `toggleBookmark`, `isBookmarked`, `getNotes`,
       `setNotes`, `getPlaylists`, `setPlaylists`, `getLastRead`,
       `setLastRead`, etc.):

      - Keep the localStorage-backed `_g`/`_s` as the synchronous fallback.
      - When `Auth.user` is set, namespace the prefix:
            STORAGE_PFX_NS = STORAGE_PFX + 'u:' + Auth.user.sub + ':'
        Reads/writes under sign-in use this namespaced prefix.
      - Keep `prefs` on the legacy prefix always (UX state is device-local).
      - Add `Store._remoteGet()` → `fetch('/api/store', { credentials: 'same-origin' })` -> JSON
      - Add `Store._remotePut(snapshot)` → `fetch('/api/store',
          { method: 'PUT', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snapshot) })`.
        Debounce remote PUTs to ~1500ms; coalesce multiple writes; if a PUT
        is in-flight, queue one trailing write.
      - Add `Store.snapshot()` reading bookmarks/notes/playlists/lastRead
        from the active prefix → KV blob shape.
      - Add `Store.applySnapshot(s)` writing each section back into the
        active prefix without triggering a remote PUT.
      - Add `Store._mergeSnapshots(local, remote)` last-write-wins by `t`:
          bookmarks: union by key; on collision, higher `t` wins
                     (no `t` on remote → prefer local; no `t` on local → prefer remote).
          notes:     union by key; same `t` rule (notes don't carry `t` today;
                     treat remote as canonical when local hasn't been touched).
          playlists: union by `id`; on collision, higher `t` wins.
          lastRead:  pick the side with the higher `t`.
      - On boot, after `Auth.load()` returns:
          if user signed in:
            local = Store.snapshot()         // legacy non-namespaced prefix
            remote = await Store._remoteGet()
            merged = Store._mergeSnapshots(local, remote)
            Store.activatePrefix(user.sub)   // switch to namespaced prefix
            Store.applySnapshot(merged)
            await Store._remotePut(merged)
            // Do NOT delete legacy keys — keep them so signing out
            // leaves the user with their original data.
          else:
            // stay on legacy prefix; app behaves as today
      - On every successful `_s()` write while signed in: schedule a
        debounced remote PUT of the full snapshot.
      - `window.addEventListener('storage', ...)`: when another tab on the
        same browser writes a key under the active prefix, refresh in-memory
        caches and repaint the affected UI sections.

   3) Render the account UI:
      - Signed-out: `#btn-account` shows a generic person SVG; click →
        `Auth.signIn()`. `#account-dropdown` stays `hidden`.
      - Signed-in: replace the SVG with `<img src="<user.picture>"
        referrerpolicy="no-referrer" alt="">` (rounded, 24px). Click toggles
        `#account-dropdown`:
            <div class="acct-name">{user.name}</div>
            <div class="acct-email">{user.email}</div>
            <button id="btn-signout">Sign out</button>
      - Click outside dropdown closes it (extend the existing close-on-
        outside-click handler that already does this for `.prefs-dropdown`).
      - Wire `Auth.onChange()` so the UI updates when sign-in state changes.

   4) Boot sequence:
      - Kick off `Auth.load()` early, but do NOT block initial render of
        the static content — sign-in is enhancement, not gate.
      - After `Auth.load()` resolves: run merge/sync if signed in, then
        render the account UI.

MODIFY  styles.css
   - Add styles for `#btn-account` (rounded, 24px image or SVG).
   - Add `.account-dropdown` styled to match the existing `.prefs-dropdown`
     glass aesthetic (same surface, padding, border, shadow). Visible
     when the `[hidden]` attribute is removed.
   - `.acct-name` (semibold), `.acct-email` (muted, smaller).
   - `#btn-signout` styled like other secondary buttons in the app.

CREATE  README-AUTH.md  (at the repo root)
   Operator runbook documenting:
     - Google Cloud Console steps:
         * Create project; OAuth consent screen (External, scopes
           openid/email/profile, add yourself as a test user).
         * Create OAuth Client ID (Web application).
           Authorized JavaScript origins:
             https://tech-primer.ronitmehta817.workers.dev
             http://localhost:8787
           Authorized redirect URIs:
             https://tech-primer.ronitmehta817.workers.dev/auth/callback
             http://localhost:8787/auth/callback
     - Cloudflare setup:
         * `npm install` at the repo root
         * `npx wrangler login`
         * Create KV: `npx wrangler kv namespace create USER_STORE`
           Copy `id` and `preview_id` into `wrangler.toml`.
         * Set secrets:
             npx wrangler secret put GOOGLE_CLIENT_SECRET
             npx wrangler secret put SESSION_SECRET
           (use `openssl rand -hex 32` for SESSION_SECRET)
         * Set the public env var GOOGLE_CLIENT_ID via dashboard or
           `[vars]` block in wrangler.toml.
     - Local dev:
         * Create `.dev.vars` from `.dev.vars.example` with real values
           (this file IS gitignored).
         * `npm run dev` (runs `wrangler dev` on http://localhost:8787).
         * Test the full Google flow against localhost; the OAuth client
           must have http://localhost:8787 + /auth/callback registered.
     - Deploy:
         * `npm run deploy`.
     - Rotating SESSION_SECRET invalidates all sessions (re-login required).
     - Tail logs: `npm run tail`.

=========================================================
SECURITY REQUIREMENTS
=========================================================
- Never log Client Secret, Session Secret, ID tokens, or session JWTs.
  `console.error` is fine for unexpected errors but must redact tokens.
- Use Web Crypto (SubtleCrypto) only. No third-party JWT libs.
- Validate `iss`, `aud`, `exp`, `iat`, and `nonce` on Google ID tokens.
- Constant-time compare for the OAuth `state` parameter.
- Cookies: HttpOnly, Secure, SameSite=Lax, Path=/.
- /api/store PUT enforces 262144-byte body cap; reject 413 otherwise.
- Top-level keys in PUT body MUST be a subset of
  { bookmarks, notes, playlists, lastRead, updatedAt }. Reject 400 on
  shape mismatch.
- All /auth/* and /api/* responses send `Cache-Control: no-store`.
- The router MUST fall through to `env.ASSETS.fetch(request)` for any
  path that isn't a recognized auth/api route, so static delivery is
  unchanged.
- The Worker MUST NOT enable `nodejs_compat` unless strictly necessary.
  Aim for pure Web APIs.

=========================================================
ACCEPTANCE CRITERIA
=========================================================
A. Signed-out user: site behaves exactly like before. localStorage
   continues to work; no /api or /auth requests required for browsing.
B. Click "Sign in" → Google consent → returns to the page they were on.
C. After sign-in, header shows Google avatar; dropdown shows name +
   email + Sign out.
D. Bookmarks/notes/playlists created while signed-out are merged into
   the server on first sign-in (no data loss).
E. Open the same site in a private window or different browser, sign in
   with the same Google account → all bookmarks, notes, playlists,
   last-read appear within ~2s of `/api/store` GET.
F. Make a change in browser A; within ~2-3s + a refresh, browser B sees
   it. (Polling/realtime is out of scope.)
G. Sign out → identity cleared, dropdown closes, site keeps working
   with whatever was last in localStorage.
H. /auth/* and /api/* never get cached (verify in DevTools Network panel:
   `Cache-Control: no-store` on each).
I. Snapshots <256KB round-trip through KV cleanly. >256KB rejected 413.
J. No console errors in production.
K. Static asset delivery is unchanged: same URLs, same Cache-Control
   headers from `_headers`, same content. Mentally trace a request to
   `/three-bg.js` — it must NOT be intercepted by the router and must
   reach `env.ASSETS.fetch`.

=========================================================
WHAT IS OUT-OF-BAND (do NOT script this)
=========================================================
- Creating the Google Cloud OAuth client.
- Setting GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET as
  Worker secrets/vars.
- Creating the KV namespace and pasting its IDs into wrangler.toml.
- Authenticating wrangler (`wrangler login`).

The README-AUTH.md you create must give exact, copy-pasteable
instructions for these steps so the user can do them in <10 minutes.

=========================================================
PROCESS
=========================================================
1. Read `index.html`, `app.js` (focus on the Store section near
   line 178 and the existing header buttons in the `.header-right`
   group), `styles.css`, and `_headers` before editing.
2. Implement files in this order so each step is independently
   verifiable:
     a. wrangler.toml, .assetsignore, .gitignore, package.json,
        .dev.vars.example
     b. src/lib/session.js, src/lib/google.js
     c. src/handlers/auth.js, src/handlers/api.js
     d. src/index.js (router + ASSETS fallthrough)
     e. _headers (no-store rules at top)
     f. index.html (account button + og:url)
     g. styles.css (account button + dropdown)
     h. app.js (Auth module → Store refactor → UI wiring)
     i. README-AUTH.md
3. After substantive edits, run lints. Fix any introduced errors.
4. Verify the static asset fallthrough by mentally tracing a request to
   `/three-bg.js` — it must NOT be intercepted by the router and must
   reach `env.ASSETS.fetch`.
5. Do NOT commit unless explicitly asked.

Begin now. Start by reading the files listed in step 1.
