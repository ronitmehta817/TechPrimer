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
