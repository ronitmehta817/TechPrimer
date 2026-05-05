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
