
---

## 1. Summary

| Action     | Count | Items |
|------------|-------|-------|
| New code   | 11    | `.gitignore`, `.assetsignore`, `.dev.vars.example`, `package.json`, `wrangler.toml`, `src/index.js`, `src/handlers/auth.js`, `src/handlers/api.js`, `src/lib/session.js`, `src/lib/google.js`, `src/lib/limiter.js`, `src/lib/errors.js` |
| New docs   | 4     | `AUTH-IMPLEMENTATION.md`, `COMMANDS.md`, `README-AUTH.md`, `auth-prompt.md` |
| Modified   | 4     | `_headers`, `index.html`, `styles.css`, `app.js` |
| Unchanged  | 8     | `content.js`, `question-sections.js`, `sitemap.xml`, `three-welcome.js`, `three-bg.js`, `vendor.js`, `manifest.json`, `robots.txt` |

## 2. How to Apply

The whole patch is one rsync invocation — it adds every new file, overwrites the four modified files, leaves the eight unchanged files alone, and preserves nothing in `TechPrimmer_backup_pre_auth/` that doesn't exist in `TechPrimmer/`:

```bash
rsync -av --delete --exclude='.DS_Store' \
  TechPrimmer/ TechPrimmer_backup_pre_auth/
```

The rest of this document is the patch's *content*: every line of code in every new or modified file.

---

## 3. New Configuration Files

### 3.1 `.gitignore`

```gitignore
.dev.vars
.wrangler/
node_modules/
.DS_Store
```

### 3.2 `.assetsignore`

Cloudflare's `[assets]` binding uploads every file in the project root *except* the entries listed here. Source, secrets, dotfiles, and docs all belong here so they never become public static assets.

```gitignore
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
COMMANDS.md
auth-prompt.md
.gitignore
.git/
```

### 3.3 `.dev.vars.example`

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=
```

### 3.4 `package.json`

```json
{
  "name": "tech-primer",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "kv:create": "wrangler kv namespace create USER_STORE",
    "kv:create:preview": "wrangler kv namespace create USER_STORE --preview",
    "tail": "wrangler tail"
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
```

### 3.5 `wrangler.toml`

```toml
# Cloudflare Worker config for tech-primer.
#
# BEFORE FIRST DEPLOY:
#   1. Run `npm run kv:create` and paste the returned `id` into the
#      [[kv_namespaces]] block below as `id`.
#   2. Run `npm run kv:create:preview` and paste the returned `id` into
#      `preview_id` (used by `wrangler dev`).
#   3. Set the two secrets via `npx wrangler secret put` (see README-AUTH.md):
#        - GOOGLE_CLIENT_SECRET
#        - SESSION_SECRET   (use `openssl rand -hex 32`)
#   4. Either uncomment the [vars] block below with your real client id, or
#      set GOOGLE_CLIENT_ID via the Cloudflare dashboard. It's a public value
#      so committing it to source control is fine.
#
# Static files in this directory are served via the [assets] binding
# below; .assetsignore controls which files DON'T get uploaded.

name = "tech-primer"
main = "src/index.js"
compatibility_date = "2024-12-01"

[assets]
directory = "./"
binding = "ASSETS"
not_found_handling = "single-page-application"

[[kv_namespaces]]
binding = "USER_STORE"
id = "REPLACE_WITH_KV_NAMESPACE_ID"
preview_id = "REPLACE_WITH_KV_PREVIEW_ID"

# Public, non-secret env vars. GOOGLE_CLIENT_ID is exposed to the browser
# anyway in the OAuth redirect URL, so it doesn't need to be a Worker
# secret. Uncomment and fill in to commit it from source control; otherwise
# set it via the Cloudflare dashboard or `wrangler secret put`.
# [vars]
# GOOGLE_CLIENT_ID = "your-google-client-id.apps.googleusercontent.com"

[observability]
enabled = true
```

---

## 4. New Worker Backend (`src/`)

### 4.1 `src/index.js`

```javascript
// Single Worker entry. Hand-rolled router (six routes — not enough to
// justify a router library). Anything that doesn't match falls through
// to env.ASSETS.fetch, which serves the original static site unchanged.
//
// Cross-cutting concerns applied here so handlers stay simple:
//   1. Method gating with consistent 405 + Allow header.
//   2. Rate limiting (in-isolate sliding window). Auth/me are limited per
//      client IP; /api/store is limited per session `sub` after a fast
//      session verify. Limits are intentionally conservative for a
//      personal site on the Cloudflare free tier.
//   3. Session pre-verify for /api/store so handlers receive the verified
//      session as a 3rd arg and never have to redo it.
//   4. Structured logging for security-relevant events (rate limit trips,
//      handler exceptions). Never logs cookies, tokens, or user blobs.

import { handleLogin, handleCallback, handleLogout } from './handlers/auth.js';
import { handleMe, handleStoreGet, handleStorePut } from './handlers/api.js';
import { getSessionFromRequest } from './lib/session.js';
import { take, clientIp } from './lib/limiter.js';
import { jsonError, rateLimited, methodNotAllowed } from './lib/errors.js';

// Per-endpoint limits. Tuned for one human user on a personal site.
const LIMITS = {
  authLogin:    { limit: 10,  windowMs: 60_000 },  // per IP
  authCallback: { limit: 10,  windowMs: 60_000 },  // per IP
  authLogout:   { limit: 30,  windowMs: 60_000 },  // per IP (cheap, but stop logout spam)
  apiMe:        { limit: 60,  windowMs: 60_000 },  // per IP (every page load hits this once)
  apiStoreGet:  { limit: 120, windowMs: 60_000 },  // per sub
  apiStorePut:  { limit: 60,  windowMs: 60_000 },  // per sub (client debounces at 1.5s = ≤40/min)
};

function logEvent(event, request, extra = {}) {
  try {
    const ip = clientIp(request);
    const ua = (request.headers.get('user-agent') || '').slice(0, 120);
    console.log(JSON.stringify({ event, ip, ua, ...extra }));
  } catch { /* logging is best-effort */ }
}

function ipLimit(request, key, conf) {
  const ip = clientIp(request);
  const r = take(`${key}:ip:${ip}`, conf.limit, conf.windowMs);
  if (!r.ok) {
    logEvent('rate_limited', request, { route: key, mode: 'ip' });
  }
  return r;
}

function subLimit(request, key, sub, conf) {
  const r = take(`${key}:sub:${sub}`, conf.limit, conf.windowMs);
  if (!r.ok) {
    logEvent('rate_limited', request, { route: key, mode: 'sub', sub });
  }
  return r;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const m = request.method;

    try {
      if (pathname === '/auth/login') {
        if (m !== 'GET') return methodNotAllowed('GET');
        const r = ipLimit(request, 'auth_login', LIMITS.authLogin);
        if (!r.ok) return rateLimited(r.retryAfterMs);
        return await handleLogin(request, env);
      }

      if (pathname === '/auth/callback') {
        if (m !== 'GET') return methodNotAllowed('GET');
        const r = ipLimit(request, 'auth_callback', LIMITS.authCallback);
        if (!r.ok) return rateLimited(r.retryAfterMs);
        return await handleCallback(request, env);
      }

      if (pathname === '/auth/logout') {
        if (m !== 'GET') return methodNotAllowed('GET');
        const r = ipLimit(request, 'auth_logout', LIMITS.authLogout);
        if (!r.ok) return rateLimited(r.retryAfterMs);
        return await handleLogout(request);
      }

      if (pathname === '/api/me') {
        if (m !== 'GET') return methodNotAllowed('GET');
        const r = ipLimit(request, 'api_me', LIMITS.apiMe);
        if (!r.ok) return rateLimited(r.retryAfterMs);
        const session = await getSessionFromRequest(request, env);
        return await handleMe(request, env, session);
      }

      if (pathname === '/api/store') {
        if (m !== 'GET' && m !== 'PUT') return methodNotAllowed('GET, PUT');
        // Verify session FIRST so unauthenticated abuse short-circuits at
        // 401 (cheap) and we have a real `sub` to hang the rate limit on.
        const session = await getSessionFromRequest(request, env);
        if (!session) return jsonError(401, 'unauthorized', 'Sign in required.');
        const conf = m === 'GET' ? LIMITS.apiStoreGet : LIMITS.apiStorePut;
        const key = m === 'GET' ? 'api_store_get' : 'api_store_put';
        const r = subLimit(request, key, session.sub, conf);
        if (!r.ok) return rateLimited(r.retryAfterMs);
        if (m === 'GET') return await handleStoreGet(request, env, session);
        return await handleStorePut(request, env, session);
      }
    } catch (err) {
      // Any unexpected throw inside a handler ends up here. We log the
      // stack server-side (visible via `wrangler tail`) and return a
      // generic JSON envelope so we don't leak internals to the client.
      console.error('handler error', (err && err.stack) || err);
      return jsonError(500, 'internal_error', 'Something went wrong.');
    }

    return env.ASSETS.fetch(request);
  },
};
```

### 4.2 `src/handlers/auth.js`

```javascript
// Google OAuth on Workers: /auth/login, /auth/callback, /auth/logout.
// Authorization Code flow with state + nonce cookie protection. The
// caller's `return_to` path is stashed inside the state cookie value
// (base64url) so we don't need any server-side store between steps.
//
// Failure handling: every callback failure path (oauth error, missing
// state/nonce, state mismatch, token exchange 5xx, id_token invalid,
// nonce mismatch, missing sub, env not configured) redirects to
//   /?login_error=<machine_code>
// so the frontend can render a single, consistent UI. The frontend
// translates the code into a human-readable message; the URL itself only
// carries the code, which limits open-redirect / reflected-XSS risk.

import {
  signSession,
  serializeCookie,
  parseCookies,
  constantTimeEqual,
  randomHex,
  SESSION_COOKIE_NAME,
  SESSION_TTL,
} from '../lib/session.js';
import { verifyIdToken } from '../lib/google.js';
import { textResponse } from '../lib/errors.js';

const STATE_COOKIE = 'oauth_state';
const NONCE_COOKIE = 'oauth_nonce';
const HANDSHAKE_TTL = 600;

function toBase64Url(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64UrlToString(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

function sanitizeReturnTo(raw) {
  if (!raw) return '/';
  let v;
  try { v = decodeURIComponent(raw); } catch { return '/'; }
  if (typeof v !== 'string') return '/';
  if (!v.startsWith('/') || v.startsWith('//')) return '/';
  if (v.length > 512) return '/';
  return v;
}

// Chrome/Firefox accept Secure cookies on http://localhost as a developer
// convenience; Safari does not, so the OAuth handshake silently fails there
// during `wrangler dev`. Drop the Secure flag whenever the request itself
// arrived over plain HTTP.
function isSecureRequest(url) {
  return url.protocol === 'https:';
}

function clearedCookie(name, secure) {
  return serializeCookie(name, '', { maxAge: 0, sameSite: 'Lax', secure });
}

function buildRedirect(location, extraSetCookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  extraSetCookies.forEach((c) => headers.append('Set-Cookie', c));
  return new Response(null, { status: 302, headers });
}

// Centralised "auth flow failed; bounce the user back to / with a code the
// frontend can render as a friendly message" helper. Always strips the
// handshake cookies so a retry starts fresh.
function authFailureRedirect(code, secure, returnTo = '/') {
  const url = new URL(returnTo.startsWith('/') ? returnTo : '/', 'https://placeholder.invalid');
  url.searchParams.set('login_error', code);
  // Re-emit only the path+search (drop the placeholder origin).
  const location = url.pathname + (url.search ? url.search : '');
  return buildRedirect(location, [
    clearedCookie(STATE_COOKIE, secure),
    clearedCookie(NONCE_COOKIE, secure),
  ]);
}

// Lightweight structured log for the operator (visible via `wrangler tail`).
// Never logs tokens, secrets, or cookie values — only event + reason + ip.
function logAuthEvent(event, request, extra = {}) {
  try {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    console.log(JSON.stringify({ event, ip, ...extra }));
  } catch { /* logging is best-effort */ }
}

export async function handleLogin(request, env) {
  const url = new URL(request.url);
  const secure = isSecureRequest(url);

  if (!env.GOOGLE_CLIENT_ID) {
    logAuthEvent('login_misconfigured', request, { reason: 'missing_client_id' });
    return authFailureRedirect('not_configured', secure);
  }

  const returnTo = sanitizeReturnTo(url.searchParams.get('return_to'));
  const state = randomHex(32);
  const nonce = randomHex(32);

  const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorize.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/auth/callback`);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid email profile');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('nonce', nonce);
  authorize.searchParams.set('prompt', 'select_account');
  authorize.searchParams.set('access_type', 'online');

  const headers = new Headers({
    Location: authorize.toString(),
    'Cache-Control': 'no-store',
  });
  headers.append(
    'Set-Cookie',
    serializeCookie(STATE_COOKIE, `${state}.${toBase64Url(returnTo)}`, {
      maxAge: HANDSHAKE_TTL,
      sameSite: 'Lax',
      secure,
    }),
  );
  headers.append(
    'Set-Cookie',
    serializeCookie(NONCE_COOKIE, nonce, { maxAge: HANDSHAKE_TTL, sameSite: 'Lax', secure }),
  );

  return new Response(null, { status: 302, headers });
}

export async function handleCallback(request, env) {
  const url = new URL(request.url);
  const secure = isSecureRequest(url);
  const code = url.searchParams.get('code');
  const queryState = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    logAuthEvent('callback_oauth_error', request, { oauth_error: oauthError });
    // Pass the upstream Google error code through verbatim so the frontend
    // can show "Sign-in cancelled" vs. "Access denied" etc. We trust this
    // value because Google sends it to us; we only ever surface a known set
    // of codes in the UI, never the raw param.
    return authFailureRedirect(`oauth_${oauthError}`.slice(0, 64), secure);
  }

  if (!code || !queryState) {
    logAuthEvent('callback_missing_params', request);
    return authFailureRedirect('missing_params', secure);
  }

  const cookies = parseCookies(request.headers.get('cookie') || '');
  const stateCookie = cookies[STATE_COOKIE];
  const nonceCookie = cookies[NONCE_COOKIE];
  if (!stateCookie || !nonceCookie) {
    logAuthEvent('callback_missing_cookie', request);
    return authFailureRedirect('missing_state_cookie', secure);
  }

  const dot = stateCookie.indexOf('.');
  const cookieState = dot < 0 ? stateCookie : stateCookie.slice(0, dot);
  const returnToB64 = dot < 0 ? '' : stateCookie.slice(dot + 1);
  if (!constantTimeEqual(queryState, cookieState)) {
    logAuthEvent('callback_state_mismatch', request);
    return authFailureRedirect('state_mismatch', secure);
  }

  let returnTo = '/';
  if (returnToB64) {
    try {
      const decoded = fromBase64UrlToString(returnToB64);
      if (decoded.startsWith('/') && !decoded.startsWith('//') && decoded.length <= 512) {
        returnTo = decoded;
      }
    } catch (_) { /* keep default */ }
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) {
    logAuthEvent('callback_misconfigured', request);
    return authFailureRedirect('not_configured', secure);
  }

  let tokenRes;
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${url.origin}/auth/callback`,
        grant_type: 'authorization_code',
      }).toString(),
    });
  } catch (err) {
    logAuthEvent('token_exchange_network_error', request, { msg: String(err && err.message || err) });
    return authFailureRedirect('token_exchange_failed', secure);
  }

  if (!tokenRes.ok) {
    logAuthEvent('token_exchange_http_error', request, { status: tokenRes.status });
    return authFailureRedirect('token_exchange_failed', secure);
  }

  let tokenJson;
  try { tokenJson = await tokenRes.json(); }
  catch (err) {
    logAuthEvent('token_exchange_parse_error', request, { msg: String(err && err.message || err) });
    return authFailureRedirect('token_exchange_failed', secure);
  }

  const idToken = tokenJson && tokenJson.id_token;
  if (!idToken || typeof idToken !== 'string') {
    logAuthEvent('token_exchange_no_id_token', request);
    return authFailureRedirect('token_exchange_failed', secure);
  }

  let claims;
  try { claims = await verifyIdToken(idToken, env.GOOGLE_CLIENT_ID); }
  catch (err) {
    logAuthEvent('id_token_invalid', request, { msg: String(err && err.message || err) });
    return authFailureRedirect('id_token_invalid', secure);
  }

  if (claims.nonce !== nonceCookie) {
    logAuthEvent('nonce_mismatch', request);
    return authFailureRedirect('nonce_mismatch', secure);
  }
  if (!claims.sub) {
    logAuthEvent('missing_sub', request);
    return authFailureRedirect('missing_sub', secure);
  }

  let sessionJwt;
  try {
    sessionJwt = await signSession(
      {
        sub: claims.sub,
        email: claims.email || '',
        name: claims.name || '',
        picture: claims.picture || '',
      },
      env.SESSION_SECRET,
      SESSION_TTL,
    );
  } catch (err) {
    logAuthEvent('session_sign_failed', request, { msg: String(err && err.message || err) });
    return authFailureRedirect('session_sign_failed', secure);
  }

  // Successful sign-in. Log just the sub + email so the operator can
  // correlate to KV; we never log the session JWT itself.
  logAuthEvent('sign_in', request, { sub: claims.sub, email: claims.email || '' });

  return buildRedirect(returnTo, [
    serializeCookie(SESSION_COOKIE_NAME, sessionJwt, { maxAge: SESSION_TTL, sameSite: 'Lax', secure }),
    clearedCookie(STATE_COOKIE, secure),
    clearedCookie(NONCE_COOKIE, secure),
  ]);
}

export async function handleLogout(request) {
  const url = new URL(request.url);
  const secure = isSecureRequest(url);
  logAuthEvent('sign_out', request);
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Cache-Control': 'no-store',
      'Set-Cookie': serializeCookie(SESSION_COOKIE_NAME, '', { maxAge: 0, sameSite: 'Lax', secure }),
    },
  });
}

// Re-export so the router can build "method not allowed" plain-text bodies
// without importing errors.js itself if it ever wants to. Currently unused
// outside this file but documents the boundary.
export { textResponse };
```

### 4.3 `src/handlers/api.js`

```javascript
// /api/me   -> returns the signed-in user (from session cookie) or 401.
// /api/store
//   GET -> returns the user's full sync blob from KV (or {} if new).
//   PUT -> validates and writes the blob to KV at user:{sub}.
//
// All handlers receive the verified session as a 3rd argument from the
// router so they don't redo the JWT verify or worry about 401s. The router
// guarantees `session` is non-null for every call except handleMe (which
// accepts null and returns 401 itself, since /api/me's whole job is to
// answer "who is the current user").
//
// PUT contract (enforced top to bottom):
//   - Content-Type must be application/json (else 415)
//   - Body byte length capped at MAX_BODY_BYTES (else 413)
//   - JSON.parse must succeed (else 400 invalid_json)
//   - Top-level must be a plain object with only ALLOWED_KEYS
//   - bookmarks: object, ≤ MAX_BOOKMARKS keys; each value is
//                { title:string≤200, sid:string≤120, t:number }
//   - notes:     object, ≤ MAX_NOTES keys; each value is a string
//                ≤ MAX_NOTE_BYTES UTF-8 bytes
//   - playlists: array, ≤ MAX_PLAYLISTS items; each item is
//                { name:string≤120, items:array≤MAX_PLAYLIST_ITEMS,
//                  created?:number, id?:string, t?:number }
//                items inside: { k:string≤200, s:string≤120,
//                                c:string≤200, title:string≤300 }
//   - lastRead:  object|null with { s:string≤120, c:string≤200, t:number }
//   - updatedAt: number (ignored — server stamps this)

import { jsonOk, jsonError } from '../lib/errors.js';

const MAX_BODY_BYTES = 262144;          // 256 KB
const MAX_BOOKMARKS = 1000;
const MAX_NOTES = 500;
const MAX_PLAYLISTS = 50;
const MAX_PLAYLIST_ITEMS = 200;
const MAX_NOTE_BYTES = 32 * 1024;       // 32 KB per note
const MAX_TITLE_LEN = 200;
const MAX_LONG_TITLE_LEN = 300;
const MAX_NAME_LEN = 120;
const MAX_KEY_LEN = 200;
const MAX_SID_LEN = 120;

const ALLOWED_KEYS = new Set(['bookmarks', 'notes', 'playlists', 'lastRead', 'updatedAt']);

const enc = new TextEncoder();

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isShortString(v, max) {
  return typeof v === 'string' && v.length <= max;
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateBookmarks(bm) {
  if (!isPlainObject(bm)) return 'bookmarks must be an object';
  const keys = Object.keys(bm);
  if (keys.length > MAX_BOOKMARKS) return `too many bookmarks (max ${MAX_BOOKMARKS})`;
  for (const k of keys) {
    if (!isShortString(k, MAX_KEY_LEN)) return `bookmark key too long`;
    const v = bm[k];
    if (!isPlainObject(v)) return `bookmark "${k}" must be an object`;
    if (!isShortString(v.title, MAX_TITLE_LEN)) return `bookmark "${k}".title invalid`;
    if (!isShortString(v.sid, MAX_SID_LEN)) return `bookmark "${k}".sid invalid`;
    if (!isFiniteNumber(v.t)) return `bookmark "${k}".t invalid`;
  }
  return null;
}

function validateNotes(notes) {
  if (!isPlainObject(notes)) return 'notes must be an object';
  const keys = Object.keys(notes);
  if (keys.length > MAX_NOTES) return `too many notes (max ${MAX_NOTES})`;
  for (const k of keys) {
    if (!isShortString(k, MAX_KEY_LEN)) return `note key too long`;
    const v = notes[k];
    if (typeof v !== 'string') return `note "${k}" must be a string`;
    // Per-note byte cap so a single note can't approach the total body cap.
    if (enc.encode(v).byteLength > MAX_NOTE_BYTES) return `note "${k}" too large (max ${MAX_NOTE_BYTES} bytes)`;
  }
  return null;
}

function validatePlaylistItem(it, plName) {
  if (!isPlainObject(it)) return `playlist "${plName}" item must be an object`;
  if (!isShortString(it.k, MAX_KEY_LEN)) return `playlist "${plName}" item.k invalid`;
  if (!isShortString(it.s, MAX_SID_LEN)) return `playlist "${plName}" item.s invalid`;
  if (!isShortString(it.c, MAX_KEY_LEN)) return `playlist "${plName}" item.c invalid`;
  if (!isShortString(it.title, MAX_LONG_TITLE_LEN)) return `playlist "${plName}" item.title invalid`;
  return null;
}

function validatePlaylists(pls) {
  if (!Array.isArray(pls)) return 'playlists must be an array';
  if (pls.length > MAX_PLAYLISTS) return `too many playlists (max ${MAX_PLAYLISTS})`;
  for (const pl of pls) {
    if (!isPlainObject(pl)) return 'playlist must be an object';
    if (!isShortString(pl.name, MAX_NAME_LEN)) return 'playlist.name invalid';
    if (!Array.isArray(pl.items)) return `playlist "${pl.name}" items must be an array`;
    if (pl.items.length > MAX_PLAYLIST_ITEMS) {
      return `playlist "${pl.name}" has too many items (max ${MAX_PLAYLIST_ITEMS})`;
    }
    // created / id / t are optional and best-effort. Just type-check if present.
    if (pl.created !== undefined && !isFiniteNumber(pl.created)) return 'playlist.created invalid';
    if (pl.id !== undefined && !isShortString(pl.id, MAX_KEY_LEN)) return 'playlist.id invalid';
    if (pl.t !== undefined && !isFiniteNumber(pl.t)) return 'playlist.t invalid';
    for (const it of pl.items) {
      const itErr = validatePlaylistItem(it, pl.name);
      if (itErr) return itErr;
    }
  }
  return null;
}

function validateLastRead(lr) {
  if (lr === null) return null;
  if (!isPlainObject(lr)) return 'lastRead must be an object or null';
  if (!isShortString(lr.s, MAX_SID_LEN)) return 'lastRead.s invalid';
  if (!isShortString(lr.c, MAX_KEY_LEN)) return 'lastRead.c invalid';
  if (!isFiniteNumber(lr.t)) return 'lastRead.t invalid';
  return null;
}

export async function handleMe(request, env, session) {
  if (!session) return jsonError(401, 'unauthorized', 'Sign in required.');
  return jsonOk({
    sub: session.sub,
    email: session.email,
    name: session.name,
    picture: session.picture,
  });
}

export async function handleStoreGet(request, env, session) {
  if (!env.USER_STORE) return jsonError(500, 'kv_not_bound', 'Server misconfigured.');
  let data;
  try {
    data = await env.USER_STORE.get(`user:${session.sub}`, 'json');
  } catch (err) {
    console.error(JSON.stringify({ event: 'kv_get_failed', sub: session.sub, msg: String(err && err.message || err) }));
    return jsonError(502, 'kv_get_failed', 'Could not read from storage.');
  }
  // Defensive: if KV ever has non-object data (legacy / corruption), don't
  // hand it to the client untouched — return an empty blob and log.
  if (data !== null && data !== undefined && !isPlainObject(data)) {
    console.error(JSON.stringify({ event: 'kv_corrupt', sub: session.sub, type: typeof data }));
    return jsonOk({});
  }
  return jsonOk(data || {});
}

// Light helper to log a validation rejection without leaking payload contents.
// We log the code (so the operator can see "ten people are tripping
// invalid_notes today") and the sub (so they can ask the user about it).
function logPutReject(sub, code, detail) {
  try {
    console.log(JSON.stringify({ event: 'put_validation_failed', sub, code, detail }));
  } catch { /* logging is best-effort */ }
}

export async function handleStorePut(request, env, session) {
  if (!env.USER_STORE) return jsonError(500, 'kv_not_bound', 'Server misconfigured.');

  const ct = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (ct !== 'application/json') {
    logPutReject(session.sub, 'unsupported_media_type', ct || '(none)');
    return jsonError(415, 'unsupported_media_type', 'Content-Type must be application/json.');
  }

  // Cheap pre-check using Content-Length so we can short-circuit obviously
  // oversized uploads without buffering them. The post-read byte check is
  // still authoritative because Content-Length is client-supplied.
  const cl = Number(request.headers.get('content-length'));
  if (Number.isFinite(cl) && cl > MAX_BODY_BYTES) {
    logPutReject(session.sub, 'body_too_large', `cl=${cl}`);
    return jsonError(413, 'body_too_large', `Body exceeds ${MAX_BODY_BYTES} bytes.`);
  }

  let text;
  try { text = await request.text(); }
  catch { return jsonError(400, 'body_read_failed', 'Could not read request body.'); }

  // Re-measure as UTF-8 bytes (not UTF-16 code units).
  const byteLen = enc.encode(text).byteLength;
  if (byteLen > MAX_BODY_BYTES) {
    logPutReject(session.sub, 'body_too_large', `bytes=${byteLen}`);
    return jsonError(413, 'body_too_large', `Body exceeds ${MAX_BODY_BYTES} bytes.`);
  }

  let body;
  try { body = JSON.parse(text); }
  catch {
    logPutReject(session.sub, 'invalid_json');
    return jsonError(400, 'invalid_json', 'Body is not valid JSON.');
  }

  if (!isPlainObject(body)) {
    logPutReject(session.sub, 'invalid_shape');
    return jsonError(400, 'invalid_shape', 'Body must be a JSON object.');
  }

  for (const k of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(k)) {
      logPutReject(session.sub, 'unexpected_key', k);
      return jsonError(400, 'unexpected_key', `Unexpected top-level key "${k}".`);
    }
  }

  if (body.bookmarks !== undefined) {
    const err = validateBookmarks(body.bookmarks);
    if (err) {
      logPutReject(session.sub, 'invalid_bookmarks', err);
      return jsonError(400, 'invalid_bookmarks', err);
    }
  }
  if (body.notes !== undefined) {
    const err = validateNotes(body.notes);
    if (err) {
      logPutReject(session.sub, 'invalid_notes', err);
      return jsonError(400, 'invalid_notes', err);
    }
  }
  if (body.playlists !== undefined) {
    const err = validatePlaylists(body.playlists);
    if (err) {
      logPutReject(session.sub, 'invalid_playlists', err);
      return jsonError(400, 'invalid_playlists', err);
    }
  }
  if (body.lastRead !== undefined) {
    const err = validateLastRead(body.lastRead);
    if (err) {
      logPutReject(session.sub, 'invalid_last_read', err);
      return jsonError(400, 'invalid_last_read', err);
    }
  }

  body.updatedAt = Date.now();

  try {
    await env.USER_STORE.put(`user:${session.sub}`, JSON.stringify(body));
  } catch (err) {
    console.error(JSON.stringify({ event: 'kv_put_failed', sub: session.sub, msg: String(err && err.message || err) }));
    return jsonError(502, 'kv_put_failed', 'Could not write to storage.');
  }

  return jsonOk({ updatedAt: body.updatedAt });
}
```

### 4.4 `src/lib/session.js`

```javascript
// HS256 JWT helpers + cookie utilities. All session work (sign / verify /
// read-from-request / cookie serialization) flows through here so cookie
// flags and signing parameters are applied identically by every endpoint.
// Pure Web APIs only — runs unchanged on Workers or Pages Functions.

const SESSION_COOKIE = 'session';
const SESSION_DEFAULT_TTL = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64Url(input) {
  const arr = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(payload, secret, ttlSeconds = SESSION_DEFAULT_TTL) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = toBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = toBase64Url(enc.encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  return `${signingInput}.${toBase64Url(sig)}`;
}

export async function verifySession(jwt, secret) {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  let key;
  try { key = await importHmacKey(secret); } catch { return null; }
  let sigBytes;
  try { sigBytes = fromBase64Url(sigB64); } catch { return null; }
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    enc.encode(`${headerB64}.${payloadB64}`),
  );
  if (!ok) return null;
  let payload;
  try { payload = JSON.parse(dec.decode(fromBase64Url(payloadB64))); }
  catch { return null; }
  if (typeof payload.exp === 'number' && Math.floor(Date.now() / 1000) >= payload.exp) return null;
  return payload;
}

export function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${opts.maxAge}`);
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(/;\s*/).forEach((pair) => {
    const eq = pair.indexOf('=');
    if (eq < 0) return;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomHex(byteCount) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

export async function getSessionFromRequest(request, env) {
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const jwt = cookies[SESSION_COOKIE];
  if (!jwt) return null;
  if (!env || !env.SESSION_SECRET) return null;
  return verifySession(jwt, env.SESSION_SECRET);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_TTL = SESSION_DEFAULT_TTL;
```

### 4.5 `src/lib/google.js`

```javascript
// Verifies Google-issued ID tokens (RS256) by downloading and caching their
// JSON Web Key Set, then checking signature + iss + aud + exp + iat. Pure
// Web Crypto, no third-party deps.

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const FALLBACK_TTL_MS = 60 * 60 * 1000;
const MIN_TTL_MS = 60 * 1000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;

let jwksCache = { keys: null, expiresAt: 0 };

const enc = new TextEncoder();
const dec = new TextDecoder();

function fromBase64Url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getJwks() {
  const now = Date.now();
  if (jwksCache.keys && jwksCache.expiresAt > now) return jwksCache.keys;
  const res = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error('jwks fetch failed: ' + res.status);
  const data = await res.json();
  let ttlMs = FALLBACK_TTL_MS;
  const cc = res.headers.get('cache-control') || '';
  const m = /max-age=(\d+)/i.exec(cc);
  if (m) ttlMs = Math.max(MIN_TTL_MS, Math.min(parseInt(m[1], 10) * 1000, MAX_TTL_MS));
  jwksCache = { keys: data.keys || [], expiresAt: now + ttlMs };
  return jwksCache.keys;
}

async function importJwk(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

export async function verifyIdToken(idToken, expectedAudience) {
  if (!idToken || typeof idToken !== 'string') throw new Error('missing id_token');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed id_token');
  const [headerB64, payloadB64, sigB64] = parts;

  let header, payload;
  try { header = JSON.parse(dec.decode(fromBase64Url(headerB64))); }
  catch { throw new Error('bad id_token header'); }
  try { payload = JSON.parse(dec.decode(fromBase64Url(payloadB64))); }
  catch { throw new Error('bad id_token payload'); }

  if (header.alg !== 'RS256') throw new Error('unexpected alg: ' + header.alg);
  if (!header.kid) throw new Error('missing kid');

  const keys = await getJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('no matching jwk for kid');

  const key = await importJwk(jwk);
  const sigBytes = fromBase64Url(sigB64);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    sigBytes,
    enc.encode(`${headerB64}.${payloadB64}`),
  );
  if (!ok) throw new Error('signature verification failed');

  if (!ISSUERS.includes(payload.iss)) throw new Error('bad iss');
  if (payload.aud !== expectedAudience) throw new Error('bad aud');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || now >= payload.exp) throw new Error('id_token expired');
  if (typeof payload.iat === 'number' && payload.iat - 60 > now) throw new Error('id_token iat in future');

  return payload;
}
```

### 4.6 `src/lib/limiter.js`

```javascript
// Sliding-window rate limiter, in-isolate. Each Cloudflare isolate maintains
// its own counter, so the effective global limit is roughly
// (configured limit) × (isolates serving your traffic). For free-tier
// personal use this is plenty; for production-grade per-IP limits across
// every colo, configure Cloudflare WAF Rate Limiting Rules at the dashboard.
//
// Why not KV-backed? KV writes are billed (1k/day on free tier) and the
// limiter itself would be the largest writer. Why not Durable Objects? They
// add ~50 ms per call and a complexity cost we don't need.
//
// Memory bound: MAX_TRACKED_KEYS prevents unbounded growth from a flood of
// unique keys. When the bucket count gets near the cap we evict stale and
// then oldest-half entries.

const MAX_TRACKED_KEYS = 10_000;
const STALE_AFTER_MS = 5 * 60 * 1000;

const buckets = new Map();

function evictIfFull() {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  const cutoff = Date.now() - STALE_AFTER_MS;
  for (const [k, v] of buckets) {
    if (v.lastTouched < cutoff) buckets.delete(k);
  }
  if (buckets.size < MAX_TRACKED_KEYS) return;
  const sorted = Array.from(buckets.entries()).sort(
    (a, b) => a[1].lastTouched - b[1].lastTouched,
  );
  const toDrop = Math.floor(sorted.length / 2);
  for (let i = 0; i < toDrop; i++) buckets.delete(sorted[i][0]);
}

// Take one slot from the bucket identified by `key`. Returns
//   { ok: true, remaining }   when the request is allowed,
//   { ok: false, retryAfterMs } when the bucket is full.
export function take(key, limit, windowMs) {
  const now = Date.now();
  evictIfFull();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [], lastTouched: now };
    buckets.set(key, bucket);
  }
  bucket.lastTouched = now;
  // Prune hits older than the window.
  if (bucket.hits.length) {
    const minStart = now - windowMs;
    let firstFresh = 0;
    while (firstFresh < bucket.hits.length && bucket.hits[firstFresh] < minStart) firstFresh++;
    if (firstFresh > 0) bucket.hits = bucket.hits.slice(firstFresh);
  }
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterMs = windowMs - (now - oldest);
    return { ok: false, retryAfterMs: Math.max(1000, retryAfterMs) };
  }
  bucket.hits.push(now);
  return { ok: true, remaining: limit - bucket.hits.length };
}

// `cf-connecting-ip` is the Cloudflare-canonical client IP. `wrangler dev`
// doesn't set it, so we fall back to the first entry in `x-forwarded-for`
// and finally to a sentinel so the limiter still does *something* locally.
export function clientIp(request) {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return 'unknown';
}
```

### 4.7 `src/lib/errors.js`

```javascript
// Standardized JSON response envelopes for /api/* and the catch-all 5xx
// path in the router. Every JSON error has the same shape so the frontend
// can branch on `code` and never has to parse free-form text.
//
//   { error: "<machine_code>", message: "<human_readable>" }
//
// 429s additionally include the Retry-After header (in whole seconds) so
// well-behaved clients can back off without parsing the body.
//
// We add the same minimal security headers here that `_headers` adds to
// static assets, because Worker-generated responses don't pass through the
// assets binding and therefore wouldn't otherwise pick those up. JSON
// payloads don't need a CSP, but `nosniff` prevents browsers from being
// tricked into treating an error JSON as HTML/script.

const NO_STORE = { 'Cache-Control': 'no-store' };
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
const JSON_HEADERS = { 'Content-Type': 'application/json', ...NO_STORE, ...SECURITY };

export function jsonOk(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}

export function jsonError(status, code, message, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function rateLimited(retryAfterMs) {
  const sec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return jsonError(429, 'rate_limited', 'Too many requests. Please slow down.', {
    'Retry-After': String(sec),
  });
}

export function methodNotAllowed(allow) {
  return new Response(JSON.stringify({ error: 'method_not_allowed', message: 'Method not allowed.' }), {
    status: 405,
    headers: { ...JSON_HEADERS, Allow: allow },
  });
}

// Plain-text response helper used by /auth/* failures we want to surface as
// HTTP-level errors (rare — almost everything in /auth/* should be a
// 302 redirect to /?login_error=<code> instead, so the frontend can render
// the message in the same UI it always uses).
export function textResponse(status, body) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain', ...NO_STORE } });
}
```

---

## 5. Modified Files (Frontend)

### 5.1 `_headers` — full new content

The previous `_headers` only set cache rules. The new version keeps every old cache rule and prepends a security-header block at root, plus `Cache-Control: no-store` for the auth and API routes:

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https://*.googleusercontent.com https://mermaid.ink; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com; object-src 'none'; manifest-src 'self'

/auth/*
  Cache-Control: no-store

/api/*
  Cache-Control: no-store

/
  Cache-Control: public, max-age=0, must-revalidate

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/manifest.json
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/robots.txt
  Cache-Control: public, max-age=3600

/sitemap.xml
  Cache-Control: public, max-age=3600
```

### 5.2 `index.html` — full new content

The auth changes are: a new `#btn-account` button in the header right cluster (between Preferences and the theme toggle), and a new `.account-dropdown` panel just before the prefs dropdown. Plus the cache-bust version was bumped on `styles.css`.

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tech Primer — Complete Guide</title>
<meta name="description" content="A complete software engineering learning guide for system design, microservices, message queues, Spring Framework, and design patterns.">
<meta name="robots" content="index,follow">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#b09828">
<meta name="theme-color" content="#1e1e1e" media="(prefers-color-scheme: dark)">
<meta name="application-name" content="Tech Primer">
<meta name="apple-mobile-web-app-title" content="Tech Primer">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tech Primer">
<meta property="og:title" content="Tech Primer — Complete Guide">
<meta property="og:description" content="A complete software engineering learning guide for system design, microservices, message queues, Spring Framework, and design patterns.">
<meta property="og:url" content="https://tech-primer.ronitmehta817.workers.dev/">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Tech Primer — Complete Guide">
<meta name="twitter:description" content="A complete software engineering learning guide for system design, microservices, message queues, Spring Framework, and design patterns.">
<script>
// Nuke any existing service worker + its caches on every page load. The old
// caching SW traded offline support for painful cache-invalidation bugs, so
// we've removed it entirely. This inline script runs before any other script
// so even stale app.js bundles still get the cleanup treatment.
(function () {
  if (!('serviceWorker' in navigator)) return;
  var needReload = false;
  try {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      if (regs && regs.length) needReload = true;
      return Promise.all(regs.map(function (r) {
        return r.unregister().catch(function () {});
      }));
    }).then(function () {
      if (typeof caches !== 'undefined' && caches.keys) {
        return caches.keys().then(function (names) {
          if (names && names.length) needReload = true;
          return Promise.all(names.map(function (n) { return caches.delete(n); }));
        });
      }
    }).then(function () {
      // Reload once (and only once) so the freshly-unregistered page actually
      // fetches the current assets from the network instead of continuing to
      // run whatever stale JS the old SW served us.
      if (!needReload) return;
      if (sessionStorage.getItem('__sw_reset__') === '1') return;
      sessionStorage.setItem('__sw_reset__', '1');
      try { window.location.reload(); } catch (_) {}
    }).catch(function () {});
  } catch (_) {}
})();
</script>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">

<!-- All third-party CDN dependencies (Google Fonts, marked, highlight.js,
     Fuse, mermaid, pako, Three.js import map) live in vendor.js as a single
     source of truth. It uses document.write during parsing to inject the
     equivalent <link>/<script> tags inline, preserving load order and
     blocking body parsing until vendors finish. Edit vendor.js to add or
     update any HTTPS dependency — index.html should never need to grow new
     https:// URLs. -->
<script src="vendor.js?v=20260428-vendor1"></script>

    <link rel="stylesheet" href="styles.css?v=20260505-design-patterns">
</head>
<body class="home-page">
    <canvas id="bg-3d-canvas" aria-hidden="true"></canvas>
    <svg style="position:absolute;width:0;height:0" aria-hidden="true">
      <filter id="water-droplets">
        <feTurbulence type="fractalNoise" baseFrequency="0.04 0.05" numOctaves="5" seed="2" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="90" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </svg>
    <div id="progress-bar" style="width: 0%"></div>

    <header class="header">
        <div class="header-left">
            <button class="menu-toggle" id="menu-toggle" aria-label="Toggle menu">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
            </button>
            <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle sidebar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
            </button>
            <a class="logo" href="#" id="logo-link">
                <div class="logo-icon">TP</div>
                <div class="logo-text">Tech <span>Primer</span></div>
            </a>
        </div>
        <div class="header-center">
            <div class="search-wrapper">
                <div class="search-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg></div>
                <input type="text" class="search-input" id="search-input" placeholder="Search across all topics…" autocomplete="off">
                <kbd class="search-kbd">/</kbd>
                <div class="search-results" id="search-results"></div>
            </div>
        </div>
        <div class="header-right">
            <button class="header-btn" id="btn-bookmarks" aria-label="Bookmarks" title="Bookmarks">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>
            </button>
            <button class="header-btn" id="btn-playlists" aria-label="Study Playlists" title="Study Playlists">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/></svg>
            </button>
            <button class="header-btn" id="btn-preferences" aria-label="Reading Preferences" title="Preferences">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/></svg>
            </button>
            <button class="header-btn" id="btn-account" aria-label="Account" title="Sign in with Google">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
            </button>
            <div class="theme-toggle" id="theme-toggle" role="button" aria-label="Toggle theme" tabindex="0">
                <div class="theme-toggle-thumb">
                    <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/></svg>
                    <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="display:none"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/></svg>
                </div>
            </div>
        </div>
    </header>

    <div class="sidebar-overlay" id="sidebar-overlay"></div>

    <aside class="sidebar" id="sidebar">
        <div class="search-mobile">
            <div class="search-wrapper">
                <div class="search-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg></div>
                <input type="text" class="search-input" id="search-input-mobile" placeholder="Search topics…" autocomplete="off">
            </div>
        </div>
        <nav id="sidebar-nav"></nav>
    </aside>

    <aside class="chapter-toc" id="chapter-toc">
        <div class="chapter-toc-header">On this page</div>
        <nav class="chapter-toc-nav" id="chapter-toc-nav"></nav>
    </aside>

    <main class="guide-main" id="main-content">
        <div class="content-wrapper" id="content-area"></div>
    </main>

    <!-- Slide panels -->
    <div class="panel-overlay" id="panel-overlay"></div>
    <aside class="slide-panel" id="panel-bookmarks">
        <div class="panel-header"><h3>Bookmarks</h3><button class="panel-close" data-panel="panel-bookmarks" aria-label="Close">&times;</button></div>
        <div class="panel-body" id="panel-bookmarks-body"></div>
    </aside>
    <aside class="slide-panel" id="panel-playlists">
        <div class="panel-header"><h3>Study Playlists</h3><button class="panel-close" data-panel="panel-playlists" aria-label="Close">&times;</button></div>
        <div class="panel-body" id="panel-playlists-body"></div>
    </aside>

    <!-- Account dropdown (populated by app.js when signed in) -->
    <div class="account-dropdown" id="account-dropdown">
        <div class="acct-header">
            <img class="acct-avatar" id="acct-avatar" alt="" referrerpolicy="no-referrer">
            <div class="acct-meta">
                <div class="acct-name" id="acct-name"></div>
                <div class="acct-email" id="acct-email"></div>
            </div>
        </div>
        <div class="acct-sync" id="acct-sync" aria-live="polite"></div>
        <button class="acct-signout" id="btn-signout" type="button">Sign out</button>
    </div>

    <!-- Preferences dropdown -->
    <div class="prefs-dropdown" id="prefs-dropdown">
        <div class="prefs-section">
            <label class="prefs-label">Font Size</label>
            <div class="prefs-btn-group" id="prefs-font-size">
                <button data-val="S">S</button>
                <button data-val="M" class="active">M</button>
                <button data-val="L">L</button>
            </div>
        </div>
        <div class="prefs-section">
            <label class="prefs-label">Line Spacing</label>
            <div class="prefs-btn-group" id="prefs-line-spacing">
                <button data-val="compact">Compact</button>
                <button data-val="normal" class="active">Normal</button>
                <button data-val="relaxed">Relaxed</button>
            </div>
        </div>
        <div class="prefs-section">
            <label class="prefs-label">Content Width</label>
            <div class="prefs-btn-group" id="prefs-content-width">
                <button data-val="narrow">Narrow</button>
                <button data-val="default" class="active">Default</button>
                <button data-val="wide">Wide</button>
            </div>
        </div>
    </div>

    <button class="back-to-top" id="back-to-top" aria-label="Back to top">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5"/></svg>
    </button>

    <!-- Body scripts use `defer` so they execute after vendor.js's dynamic
         async=false vendor scripts have all loaded. The `CONTENT` ->
         `CONTENT_FULL` rename that used to live as an inline bridge here is
         now done at the top of app.js's IIFE — inline scripts can't be
         deferred, and we need this rename to happen after content.js. -->
    <script defer src="question-sections.js?v=20260505-design-patterns"></script>
    <script defer src="content.js?v=20260505-design-patterns"></script>
    <script type="module" src="three-bg.js?v=20260430-globe-scale10"></script>
    <script type="module" src="three-welcome.js?v=20260505-design-patterns"></script>
    <script defer src="app.js?v=20260505-design-patterns"></script>
</body>
</html>
```

### 5.3 `styles.css` — Account UI block

The whole rest of the stylesheet is unchanged. The patch inserts this single block right after the `.prefs-btn-group button.active` rule (around line 781):

```css
/* ===== Account Button & Dropdown ===== */
/* The signed-in state swaps the SVG inside #btn-account for the user's
 * Google avatar. We use the same liquid-glass surface as the prefs panel
 * so the dropdown reads as part of the same family of overlays. */
#btn-account.signed-in { padding: 0; overflow: hidden; }
#btn-account .acct-btn-avatar {
    width: 100%; height: 100%;
    border-radius: inherit;
    object-fit: cover; display: block;
    position: relative; z-index: 1;
}

.account-dropdown {
    position: fixed; top: calc(var(--header-height) + var(--shell-gap) + 8px); right: calc(var(--shell-gap) + 8px);
    width: 260px; padding: 14px;
    background: var(--liquid-shell-strong);
    backdrop-filter: blur(4px) saturate(120%); -webkit-backdrop-filter: blur(4px) saturate(120%);
    border: 1px solid var(--liquid-border-strong);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
    z-index: 200; opacity: 0; transform: translateY(-8px) scale(0.96);
    pointer-events: none; transition: opacity 0.25s ease, transform 0.25s ease;
}
.account-dropdown.active { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.acct-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.acct-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    flex-shrink: 0; object-fit: cover;
    border: 1px solid var(--liquid-border-strong);
    box-shadow: var(--liquid-shadow);
}
.acct-meta { min-width: 0; flex: 1; }
.acct-name { font-size: 14px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acct-email { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.acct-sync { font-size: 11.5px; color: var(--text-tertiary); margin-bottom: 12px; min-height: 1em; }
.acct-sync.error { color: #c0392b; }
.acct-sync.success { color: var(--accent); }
.acct-signout {
    width: 100%; padding: 8px 0;
    border-radius: 7px; font-size: 13px; font-weight: 500;
    border: 1px solid var(--liquid-border);
    background: var(--liquid-shell);
    color: var(--text-primary); cursor: pointer; font-family: var(--font-sans);
    transition: background var(--transition), border-color var(--transition), color var(--transition);
}
.acct-signout:hover { background: var(--liquid-shell-strong); border-color: var(--liquid-border-strong); color: var(--accent); }

@media (max-width: 768px) {
    .account-dropdown { right: 8px; width: 240px; }
}
```

### 5.4 `app.js` — Auth + Storage + Account UI

Three blocks were inserted, plus a few tiny touch-ups in `init()`. Everything else in `app.js` is unchanged.

#### 5.4.1 New `AUTH` block (insert before the original `STORAGE` block)

```javascript
  // ===================== AUTH =====================
  // Holds the currently signed-in Google user (or null), and provides
  // signIn/signOut helpers. `load()` is called once at boot to populate
  // `user` from /api/me; `onChange` listeners fire whenever user changes.
  //
  // Human-readable messages for every code the server can stash into
  // `?login_error=...` after a failed callback. The URL never carries free
  // text — only one of these whitelisted codes — so reflected XSS via the
  // login_error param isn't possible. Unknown codes fall through to a
  // generic message.
  var LOGIN_ERROR_MESSAGES = {
    oauth_access_denied:           'Sign-in was cancelled.',
    oauth_invalid_request:         'Sign-in failed: invalid request.',
    oauth_unauthorized_client:     'This app is not authorized.',
    oauth_unsupported_response_type: 'Sign-in failed: unsupported response.',
    oauth_invalid_scope:           'Sign-in failed: invalid scope.',
    oauth_server_error:            'Google had a problem; please try again.',
    oauth_temporarily_unavailable: 'Google is temporarily unavailable.',
    state_mismatch:                'Sign-in expired or was tampered with. Please try again.',
    missing_state_cookie:          'Browser blocked sign-in cookies. Allow cookies and retry.',
    missing_params:                'Sign-in failed: missing data from Google.',
    nonce_mismatch:                'Sign-in failed integrity check. Please try again.',
    missing_sub:                   'Sign-in failed: Google did not return your account ID.',
    token_exchange_failed:         'Could not contact Google. Please try again.',
    id_token_invalid:              'Sign-in failed: invalid token from Google.',
    session_sign_failed:           'Server could not create your session. Please try again.',
    not_configured:                'Sign-in is not configured on this server.'
  };

  var Auth = {
    user: null,
    loaded: false,
    pendingLoginError: null,    // { code, message } from URL on boot
    _listeners: [],
    _signingIn: false,          // double-click guard, see signIn()
    // Single mutation point for `user` so every path (boot, in-page sign-out,
    // session-expired 401 from /api/store) consistently fans out to listeners
    // and the account UI repaints. Direct assignment to Auth.user bypasses
    // listeners and leaves the avatar stuck in the old state.
    _setUser: function (u) {
      this.user = (u && u.sub) ? u : null;
      var self = this;
      this._listeners.forEach(function (fn) { try { fn(self.user); } catch (_) {} });
    },
    load: function () {
      var self = this;
      return fetch('/api/me', { credentials: 'same-origin' }).then(function (r) {
        return r.ok ? r.json() : null;
      }).catch(function () { return null; }).then(function (u) {
        self._setUser(u);
        self.loaded = true;
        return self.user;
      });
    },
    onChange: function (fn) { this._listeners.push(fn); },
    signIn: function () {
      // The button click handler can fire many times before the navigation
      // actually starts (especially on slow networks or impatient users).
      // Refusing duplicate calls within a 5-second window prevents a flurry
      // of /auth/login redirects, each of which would burn one rate-limit
      // slot and could trip the per-IP limiter unnecessarily.
      if (this._signingIn) return;
      this._signingIn = true;
      setTimeout(function () { Auth._signingIn = false; }, 5000);
      var rt = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      window.location.href = '/auth/login?return_to=' + rt;
    },
    signOut: function () { window.location.href = '/auth/logout'; },
    // Called once at boot. If the URL has ?login_error=<code>, we capture
    // the matching message into `pendingLoginError` and strip the param
    // (and any leftover ?code/?state from a half-completed callback) so a
    // page refresh doesn't re-show the error. The actual UI render happens
    // in initAccountUi() so the dropdown DOM exists by then.
    consumeLoginErrorFromUrl: function () {
      try {
        var u = new URL(window.location.href);
        var code = u.searchParams.get('login_error');
        if (!code) return;
        var msg = LOGIN_ERROR_MESSAGES[code] || 'Sign-in failed. Please try again.';
        this.pendingLoginError = { code: code, message: msg };
        u.searchParams.delete('login_error');
        u.searchParams.delete('code');
        u.searchParams.delete('state');
        u.searchParams.delete('error');
        var qs = u.searchParams.toString();
        var clean = u.pathname + (qs ? '?' + qs : '') + u.hash;
        window.history.replaceState(null, '', clean);
      } catch (_) { /* URL/replaceState may not be available; skip */ }
    }
  };
  Auth.consumeLoginErrorFromUrl();
```

#### 5.4.2 Replacement `STORAGE` block

The previous `Store` was a thin localStorage wrapper. The new one keeps the public API (`getBookmarks`, `setNotes`, `savePlaylists`, `getPrefs`, etc.) but adds remote sync, last-write-wins merge, rate-limit-aware retry, and per-user namespacing. Replace the entire previous `// ===================== STORAGE ===================== … var Store = { … };` block with this:

```javascript
  // ===================== STORAGE =====================
  // Public API matches the original Store exactly so the rest of the app
  // is unchanged. Internally:
  //   - prefs always live at the legacy prefix (device-local UX state).
  //   - bookmarks/notes/playlists/last-read live at the legacy prefix when
  //     signed-out, and at a per-user prefix (`tp-u:<sub>:`) when signed-in.
  //   - Every signed-in write schedules a debounced PUT /api/store.
  //   - On boot, if signed-in, we fetch /api/store and merge with whatever
  //     local copy exists (legacy on first sign-in, per-user prefix on
  //     subsequent sign-ins) using last-write-wins-by-`t` per entry, then
  //     persist the merged blob locally and push it back to the server.
  // SYNCED_KEYS lists the localStorage keys that participate in remote sync.
  var SYNCED_KEYS = ['bookmarks', 'notes', 'playlists', 'last-read'];
  var REMOTE_DEBOUNCE_MS = 1500;

  function userPrefixFor(sub) { return STORAGE_PFX + 'u:' + sub + ':'; }

  var Store = {
    pfx: STORAGE_PFX,
    _legacyPfx: STORAGE_PFX,
    _writeTimer: null,
    _writeInFlight: false,
    _writeQueued: false,
    _suspendRemote: false,
    _changeHandlers: [],

    _keyPrefix: function (k) { return k === 'prefs' ? this._legacyPfx : this.pfx; },

    _g: function (k, d) {
      try { var v = localStorage.getItem(this._keyPrefix(k) + k); return v ? JSON.parse(v) : d; }
      catch (e) { return d; }
    },
    _s: function (k, v) {
      try { localStorage.setItem(this._keyPrefix(k) + k, JSON.stringify(v)); } catch (e) {}
      if (!this._suspendRemote && SYNCED_KEYS.indexOf(k) !== -1 && Auth.user) {
        this._scheduleRemotePut();
      }
    },

    getLastRead:    function ()         { return this._g('last-read', null); },
    setLastRead:    function (sid, cid) { this._s('last-read', { s: sid, c: cid, t: Date.now() }); },

    getBookmarks:   function ()         { return this._g('bookmarks', {}); },
    toggleBookmark: function (key, title, sid) {
      var b = this.getBookmarks();
      if (b[key]) delete b[key]; else b[key] = { title: title, sid: sid, t: Date.now() };
      this._s('bookmarks', b);
      return !!b[key];
    },
    isBookmarked:   function (key)      { return !!this.getBookmarks()[key]; },

    getNotes:       function (key)      { return this._g('notes', {})[key] || ''; },
    setNotes:       function (key, text){ var n = this._g('notes', {}); if (text) n[key] = text; else delete n[key]; this._s('notes', n); },
    getAllNotes:    function ()         { return this._g('notes', {}); },

    getPlaylists:   function ()         { return this._g('playlists', []); },
    savePlaylists:  function (p)        { this._s('playlists', p); },

    getPrefs:       function ()         { return this._g('prefs', { fontSize: 'M', lineSpacing: 'normal', contentWidth: 'default' }); },
    savePrefs:      function (p)        { this._s('prefs', p); },

    onChange: function (fn) { this._changeHandlers.push(fn); },
    _emitChange: function () {
      this._changeHandlers.forEach(function (fn) { try { fn(); } catch (_) {} });
    },

    // Build the synced-keys snapshot from a given prefix.
    _readSnapshotFromPrefix: function (pfx) {
      function read(k, d) {
        try { var v = localStorage.getItem(pfx + k); return v ? JSON.parse(v) : d; }
        catch (e) { return d; }
      }
      return {
        bookmarks: read('bookmarks', {}),
        notes:     read('notes', {}),
        playlists: read('playlists', []),
        lastRead:  read('last-read', null)
      };
    },

    _writeSnapshotToPrefix: function (pfx, snap) {
      function write(k, v) {
        try { localStorage.setItem(pfx + k, JSON.stringify(v)); } catch (e) {}
      }
      write('bookmarks', snap.bookmarks || {});
      write('notes',     snap.notes || {});
      write('playlists', Array.isArray(snap.playlists) ? snap.playlists : []);
      if (snap.lastRead) write('last-read', snap.lastRead);
    },

    // Last-write-wins per entry, keyed by `t` where available. For notes
    // (no `t` today) we union local + remote, with remote winning on
    // collision since it is the cross-device source of truth.
    _mergeSnapshots: function (local, remote) {
      local = local || {}; remote = remote || {};
      var merged = { bookmarks: {}, notes: {}, playlists: [], lastRead: null };

      var lb = local.bookmarks || {}, rb = remote.bookmarks || {};
      Object.keys(lb).forEach(function (k) { merged.bookmarks[k] = lb[k]; });
      Object.keys(rb).forEach(function (k) {
        var lt = (lb[k] && typeof lb[k].t === 'number') ? lb[k].t : 0;
        var rt = (rb[k] && typeof rb[k].t === 'number') ? rb[k].t : 0;
        if (!lb[k] || rt >= lt) merged.bookmarks[k] = rb[k];
      });

      var ln = local.notes || {}, rn = remote.notes || {};
      Object.keys(ln).forEach(function (k) { merged.notes[k] = ln[k]; });
      Object.keys(rn).forEach(function (k) { merged.notes[k] = rn[k]; });

      var byId = {};
      var lp = Array.isArray(local.playlists) ? local.playlists : [];
      var rp = Array.isArray(remote.playlists) ? remote.playlists : [];
      lp.forEach(function (p) { if (p && p.id) byId[p.id] = p; });
      rp.forEach(function (p) {
        if (!p || !p.id) return;
        var existing = byId[p.id];
        if (!existing) { byId[p.id] = p; return; }
        var lt = existing.t || 0, rt = p.t || 0;
        if (rt >= lt) byId[p.id] = p;
      });
      merged.playlists = Object.keys(byId).map(function (id) { return byId[id]; });

      var llr = local.lastRead || null, rlr = remote.lastRead || null;
      if (!llr) merged.lastRead = rlr;
      else if (!rlr) merged.lastRead = llr;
      else merged.lastRead = ((rlr.t || 0) >= (llr.t || 0)) ? rlr : llr;

      return merged;
    },

    // Suspends local→remote sync until this wall-clock timestamp (ms).
    // Set by 429 responses' Retry-After header so we stop hammering the
    // server while the rate limiter cools down.
    _rateLimitedUntil: 0,
    _rateLimitTimer: null,
    // Set whenever a write happens while the cooldown is active. Tells
    // tick() whether to schedule a flush-after-cooldown or just clear the
    // status and stay quiet.
    _pendingFlushAfterCooldown: false,

    _handleUnauthorized: function () {
      Auth._setUser(null);
      this.deactivateSync();
      setSyncStatus('Signed out (session expired)', 'error');
    },

    _handleRateLimited: function (response, label) {
      var retryAfterSec = parseInt(response.headers.get('Retry-After') || '60', 10);
      if (!Number.isFinite(retryAfterSec) || retryAfterSec < 1) retryAfterSec = 60;
      this._rateLimitedUntil = Date.now() + retryAfterSec * 1000;
      this._scheduleRateLimitTick(label);
    },

    _scheduleRateLimitTick: function (label) {
      var self = this;
      var prefix = label || 'Sync';
      function tick() {
        var remainMs = self._rateLimitedUntil - Date.now();
        if (remainMs <= 0) {
          self._rateLimitTimer = null;
          setSyncStatus('', '');
          // Only flush after cooldown if a real write came in during the
          // cooldown window. Otherwise we'd be sending an unchanged
          // snapshot on every cooldown-end and burning KV writes for free.
          if (Auth.user && self._pendingFlushAfterCooldown) {
            self._pendingFlushAfterCooldown = false;
            self._scheduleRemotePut();
          }
          return;
        }
        var sec = Math.ceil(remainMs / 1000);
        setSyncStatus(prefix + ' rate-limited, retry in ' + sec + 's', 'error');
        self._rateLimitTimer = setTimeout(tick, 1000);
      }
      if (this._rateLimitTimer) clearTimeout(this._rateLimitTimer);
      tick();
    },

    _isRateLimited: function () {
      return Date.now() < this._rateLimitedUntil;
    },

    // Try to read the standardized JSON envelope { error, message }; fall
    // back to a generic message so the UI always has something to show.
    _readErrorBody: function (response) {
      return response.text().then(function (text) {
        try {
          var body = JSON.parse(text);
          if (body && typeof body.message === 'string') return body.message;
          if (body && typeof body.error === 'string') return body.error;
        } catch (_) { /* not JSON, fall through */ }
        return 'HTTP ' + response.status;
      }).catch(function () { return 'HTTP ' + response.status; });
    },

    _remoteGet: function () {
      var self = this;
      return fetch('/api/store', { credentials: 'same-origin' }).then(function (r) {
        if (r.status === 401) { self._handleUnauthorized(); return {}; }
        if (r.status === 429) {
          self._handleRateLimited(r, 'Sync');
          throw new Error('rate_limited');
        }
        if (!r.ok) {
          return self._readErrorBody(r).then(function (msg) {
            setSyncStatus('Sync failed: ' + msg, 'error');
            throw new Error('GET /api/store ' + r.status);
          });
        }
        return r.json();
      });
    },

    _remotePut: function (snap) {
      var self = this;
      return fetch('/api/store', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snap)
      }).then(function (r) {
        if (r.status === 401) { self._handleUnauthorized(); throw new Error('unauthorized'); }
        if (r.status === 429) {
          self._handleRateLimited(r, 'Sync');
          throw new Error('rate_limited');
        }
        if (!r.ok) {
          return self._readErrorBody(r).then(function (msg) {
            // 4xx (validation) errors mean the local snapshot can never be
            // accepted as-is; surface the reason to the user so they can
            // adjust (delete a huge note, etc.). 5xx errors mean transient
            // server trouble — show the message but the next debounced
            // flush will retry.
            setSyncStatus('Sync failed: ' + msg, 'error');
            throw new Error('PUT /api/store ' + r.status);
          });
        }
        return r.json().then(function (body) {
          setSyncStatus('Synced', 'success');
          setTimeout(function () { setSyncStatus('', ''); }, 2000);
          return body;
        });
      });
    },

    _scheduleRemotePut: function () {
      var self = this;
      if (!Auth.user) return;
      if (this._isRateLimited()) {
        // Remember that we owe the server a flush once the cooldown ends.
        this._pendingFlushAfterCooldown = true;
        return;
      }
      if (this._writeTimer) clearTimeout(this._writeTimer);
      this._writeTimer = setTimeout(function () { self._flushRemote(); }, REMOTE_DEBOUNCE_MS);
    },

    _flushRemote: function () {
      var self = this;
      this._writeTimer = null;
      if (!Auth.user) return;
      if (this._isRateLimited()) return;
      if (this._writeInFlight) { this._writeQueued = true; return; }
      this._writeInFlight = true;
      var snap = this._readSnapshotFromPrefix(this.pfx);
      this._remotePut(snap).catch(function () {}).then(function () {
        self._writeInFlight = false;
        if (self._writeQueued) { self._writeQueued = false; self._scheduleRemotePut(); }
      });
    },

    // Called once after Auth.load() resolves with a signed-in user. Picks
    // a local seed (legacy prefix on first ever sign-in for this account
    // on this browser, otherwise the per-user prefix), fetches the remote
    // blob, merges, persists locally under the per-user prefix, and pushes
    // the merged blob back so the server is up to date too.
    initSync: function () {
      var self = this;
      if (!Auth.user) return Promise.resolve(false);
      var sub = Auth.user.sub;
      var userPfx = userPrefixFor(sub);

      var hasUserData = false;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf(userPfx) === 0) { hasUserData = true; break; }
        }
      } catch (e) { /* private mode etc. */ }

      var seedPfx = hasUserData ? userPfx : this._legacyPfx;
      var localSeed = this._readSnapshotFromPrefix(seedPfx);

      return this._remoteGet().then(function (remote) {
        var merged = self._mergeSnapshots(localSeed, remote || {});
        self._suspendRemote = true;
        self.pfx = userPfx;
        self._writeSnapshotToPrefix(userPfx, merged);
        self._suspendRemote = false;
        return self._remotePut(merged).catch(function () {}).then(function () {
          self._emitChange();
          return true;
        });
      }).catch(function () {
        self.pfx = userPfx;
        self._emitChange();
        return false;
      });
    },

    // Switch back to the legacy prefix without wiping per-user data so the
    // user can sign back in later and pick up where they left off.
    deactivateSync: function () { this.pfx = this._legacyPfx; },

    // Cross-tab sync within the same browser: when another tab on this
    // origin writes to a key under the active prefix, repaint UI here.
    _handleStorageEvent: function (e) {
      if (!e || !e.key || e.key.indexOf(this.pfx) !== 0) return;
      var k = e.key.slice(this.pfx.length);
      if (SYNCED_KEYS.indexOf(k) === -1) return;
      this._emitChange();
    }
  };
  window.addEventListener('storage', function (e) { Store._handleStorageEvent(e); });
```

#### 5.4.3 Document-level click + keydown additions in `init()`

Inside the existing global `document.addEventListener('click', …)` body, add the third `if` (account dropdown auto-close on outside click):

```javascript
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-wrapper')) { dom.searchResults.classList.remove('active'); syncSearchBlur(false); }
      if (!e.target.closest('.prefs-dropdown') && !e.target.closest('#btn-preferences')) {
        var dd = document.getElementById('prefs-dropdown');
        if (dd) dd.classList.remove('active');
      }
      if (!e.target.closest('#account-dropdown') && !e.target.closest('#btn-account')) {
        var ad = document.getElementById('account-dropdown');
        if (ad) ad.classList.remove('active');
      }
    });
```

And inside the existing `document.addEventListener('keydown', …)` `Escape` branch, add the `account-dropdown` close line:

```javascript
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); dom.searchInput.focus(); }
      if (e.key === 'Escape') {
        dom.searchResults.classList.remove('active'); syncSearchBlur(false); dom.searchInput.blur(); closeSidebar(); closePanel();
        var dd = document.getElementById('prefs-dropdown'); if (dd) dd.classList.remove('active');
        var ad = document.getElementById('account-dropdown'); if (ad) ad.classList.remove('active');
      }
    });
```

Add an `initAccountUi()` call right before `registerSW()` near the bottom of `init()`:

```javascript
    initAccountUi();

    registerSW();
    initMagneticNav();
  }
```

#### 5.4.4 New `ACCOUNT UI & SYNC BOOTSTRAP` block (insert just before `document.addEventListener('DOMContentLoaded', init);`)

```javascript
  // ===================== ACCOUNT UI & SYNC BOOTSTRAP =====================
  // Renders the header account button (avatar when signed-in, generic icon
  // when signed-out), drives the dropdown, and kicks off Auth.load() +
  // Store.initSync() once at boot. Repaints sidebar nav / open panels /
  // active-chapter bookmark button when the store changes (sign-in merge,
  // cross-tab storage event, etc.).
  var SIGNED_OUT_BTN_HTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>';

  function renderAccountUi() {
    var btn = document.getElementById('btn-account');
    var dd  = document.getElementById('account-dropdown');
    if (!btn || !dd) return;
    var u = Auth.user;
    if (u) {
      btn.classList.add('signed-in');
      btn.classList.remove('has-error');
      btn.setAttribute('title', u.email || u.name || 'Account');
      btn.innerHTML = u.picture
        ? '<img class="acct-btn-avatar" src="' + u.picture + '" alt="" referrerpolicy="no-referrer">'
        : SIGNED_OUT_BTN_HTML;
      var av = document.getElementById('acct-avatar');
      var nm = document.getElementById('acct-name');
      var em = document.getElementById('acct-email');
      if (av) {
        if (u.picture) { av.src = u.picture; av.style.display = ''; }
        else av.style.display = 'none';
      }
      if (nm) nm.textContent = u.name || '';
      if (em) em.textContent = u.email || '';
    } else {
      btn.classList.remove('signed-in');
      btn.setAttribute('title', 'Sign in with Google');
      btn.innerHTML = SIGNED_OUT_BTN_HTML;
      // Don't auto-close the dropdown when there's a pending login error to
      // surface; the caller in initAccountUi() opens it deliberately.
      if (!Auth.pendingLoginError) dd.classList.remove('active');
      btn.classList.toggle('has-error', !!Auth.pendingLoginError);
    }
    renderLoginError();
  }

  // Inject (or update, or remove) a one-line error banner inside the
  // account dropdown when Auth.pendingLoginError is set. Reuses the
  // existing `.acct-sync.error` styling so we don't have to grow the CSS
  // surface for what should be a rare event.
  function renderLoginError() {
    var dd = document.getElementById('account-dropdown');
    if (!dd) return;
    var existing = dd.querySelector('.acct-login-error');
    if (!Auth.pendingLoginError) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'acct-login-error acct-sync error';
      existing.setAttribute('role', 'alert');
      // Insert at the top of the dropdown so the message is the first thing
      // the user sees once it's open.
      dd.insertBefore(existing, dd.firstChild);
    }
    existing.textContent = Auth.pendingLoginError.message;
  }

  function setSyncStatus(text, kind) {
    var el = document.getElementById('acct-sync');
    if (!el) return;
    el.className = 'acct-sync' + (kind ? ' ' + kind : '');
    el.textContent = text || '';
  }

  function refreshUiAfterStoreChange() {
    if (state.activeChapter && state.activeSection) {
      var key = chKey(state.activeSection, state.activeChapter.id);
      var btn = document.querySelector('.bookmark-btn');
      if (btn) {
        var on = Store.isBookmarked(key);
        btn.classList.toggle('active', on);
        btn.innerHTML = svg(on ? 'starFill' : 'star', 16) + (on ? ' Bookmarked' : ' Bookmark');
      }
    }
    if (typeof buildNavigation === 'function') buildNavigation();
    var bp = document.getElementById('panel-bookmarks');
    if (bp && bp.classList.contains('open')) renderBookmarksPanel();
    var pp = document.getElementById('panel-playlists');
    if (pp && pp.classList.contains('open')) renderPlaylistsPanel();
  }

  function initAccountUi() {
    var btn = document.getElementById('btn-account');
    var dd  = document.getElementById('account-dropdown');
    var so  = document.getElementById('btn-signout');
    if (!btn || !dd || !so) return;

    btn.addEventListener('click', function () {
      // Signed-in: just toggle the dropdown.
      if (Auth.user) {
        dd.classList.toggle('active');
        return;
      }
      // Signed-out with a pending login-error: two-click pattern. The
      // dropdown is auto-revealed on boot to show the message; the FIRST
      // post-boot click of the button acknowledges + retries sign-in.
      // (This avoids the trap where the dropdown is already open and the
      // user clicks the button expecting "retry" but gets a no-op toggle.)
      if (Auth.pendingLoginError) {
        Auth.pendingLoginError = null;
        Auth.signIn();
        return;
      }
      Auth.signIn();
    });
    so.addEventListener('click', function () { Auth.signOut(); });

    // Clear the login-error banner the moment the dropdown is closed so
    // we don't keep nagging after the user has acknowledged it.
    document.addEventListener('click', function (e) {
      if (!Auth.pendingLoginError) return;
      if (e.target.closest('#account-dropdown') || e.target.closest('#btn-account')) return;
      Auth.pendingLoginError = null;
      renderAccountUi();
    });

    Auth.onChange(renderAccountUi);
    Store.onChange(refreshUiAfterStoreChange);
    renderAccountUi();

    // Auto-reveal the dropdown on boot if a callback came back with an
    // error. We do this BEFORE Auth.load() so the user sees the message
    // immediately, even if /api/me is slow.
    if (Auth.pendingLoginError) dd.classList.add('active');

    Auth.load().then(function (user) {
      renderAccountUi();
      if (!user) return null;
      setSyncStatus('Syncing\u2026', '');
      return Store.initSync().then(function (ok) {
        setSyncStatus(ok ? 'Synced' : 'Offline (saved locally)', ok ? 'success' : 'error');
        if (ok) setTimeout(function () { setSyncStatus('', ''); }, 3000);
      });
    });
  }
```

---

## 6. Documentation Files Added

The four `.md` files were copied verbatim from `TechPrimmer/`. They're documentation, not runtime code, so they're not reproduced inline here — but they're part of the patch and `rsync` will copy them. Their sizes:

| File | Size | Purpose |
|------|------|---------|
| `AUTH-IMPLEMENTATION.md` | 50,569 B | Full design + rationale doc for the auth system |
| `auth-prompt.md`         | 24,657 B | Original product/design prompt that drove the auth work |
| `COMMANDS.md`            | 16,850 B | Operational runbook (deploy, secrets, rollback, KV ops) |
| `README-AUTH.md`         | 8,675 B  | Auth quickstart for a new contributor |

Open them directly in `TechPrimmer/` to read or copy.

---

## 7. Files Left Untouched

These eight files were already byte-equal in both folders (verified by `rsync --checksum`); the rsync only refreshed their mtimes:

- `content.js`
- `question-sections.js`
- `sitemap.xml`
- `three-welcome.js`
- `three-bg.js`
- `vendor.js`
- `manifest.json`
- `robots.txt`

No deletions were required 