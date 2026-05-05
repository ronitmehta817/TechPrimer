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
