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
