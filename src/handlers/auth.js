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
