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
