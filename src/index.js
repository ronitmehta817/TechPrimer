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
