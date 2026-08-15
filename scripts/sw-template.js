"use strict";

const RELEASE = @@RELEASE_JSON@@;
const CACHE_PREFIX = "techprimer-release:";
const META_KEY = "/__techprimer_release_metadata__";
const CURRENT_ASSETS = new Map(
  RELEASE.assets.map(asset => [new URL(asset.url, self.location.origin).href, asset])
);

function isNetworkOnlyPath(pathname) {
  return pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/");
}

function expectedMimeMatches(contentType, mime) {
  const value = String(contentType || "").toLowerCase();
  if (mime === "script") return value.includes("javascript");
  if (mime === "style") return value.includes("text/css");
  if (mime === "document") return value.includes("text/html");
  if (mime === "manifest") {
    return value.includes("application/manifest+json") ||
      value.includes("application/json");
  }
  if (mime === "image") return value.startsWith("image/");
  return true;
}

async function responseDigest(response) {
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const binary = String.fromCharCode(...new Uint8Array(digest));
  return btoa(binary);
}

async function validateResponse(response, asset) {
  if (!response || response.status !== 200 || response.redirected) {
    throw new Error(`Invalid response for ${asset.url}`);
  }
  if (response.type !== "basic" && response.type !== "default") {
    throw new Error(`Non-local response for ${asset.url}`);
  }
  if (!expectedMimeMatches(response.headers.get("content-type"), asset.mime)) {
    throw new Error(`Wrong MIME type for ${asset.url}`);
  }

  const digest = await responseDigest(response.clone());
  if (digest !== asset.sha256) {
    throw new Error(`Digest mismatch for ${asset.url}`);
  }
}

function releaseEntries() {
  return [RELEASE.shell, ...RELEASE.assets].filter(asset => asset.required);
}

async function verifyRelease(cache) {
  const missing = [];
  for (const asset of releaseEntries()) {
    const response = await cache.match(asset.url);
    if (!response) missing.push(asset.url);
  }
  return missing;
}

async function fetchAndValidate(asset) {
  const response = await fetch(asset.url, {
    cache: "reload",
    credentials: "same-origin",
    redirect: "error"
  });
  await validateResponse(response.clone(), asset);
  return response;
}

async function installRelease() {
  const cache = await caches.open(RELEASE.cacheName);

  try {
    for (const asset of releaseEntries()) {
      const cached = await cache.match(asset.url);
      if (cached) {
        await validateResponse(cached.clone(), asset);
        continue;
      }

      const response = await fetchAndValidate(asset);
      await cache.put(asset.url, response);
    }

    const missing = await verifyRelease(cache);
    if (missing.length > 0) {
      throw new Error(`Incomplete release cache: ${missing.join(", ")}`);
    }

    await cache.put(
      META_KEY,
      new Response(JSON.stringify({
        releaseId: RELEASE.id,
        installedAt: Date.now()
      }), {
        headers: { "content-type": "application/json" }
      })
    );
  } catch (error) {
    await caches.delete(RELEASE.cacheName);
    throw error;
  }
}

async function ownedCacheMetadata(cacheName) {
  const cache = await caches.open(cacheName);
  const response = await cache.match(META_KEY);
  if (!response) {
    return { cacheName, installedAt: 0 };
  }

  try {
    const metadata = await response.json();
    return {
      cacheName,
      installedAt: Number(metadata.installedAt) || 0
    };
  } catch {
    return { cacheName, installedAt: 0 };
  }
}

async function retainCurrentAndPrevious() {
  const names = (await caches.keys())
    .filter(name => name.startsWith(CACHE_PREFIX));
  const metadata = await Promise.all(names.map(ownedCacheMetadata));
  const previous = metadata
    .filter(item => item.cacheName !== RELEASE.cacheName)
    .sort((a, b) => b.installedAt - a.installedAt)[0];
  const keep = new Set([RELEASE.cacheName]);
  if (previous) keep.add(previous.cacheName);

  await Promise.all(metadata.map(item => {
    if (keep.has(item.cacheName)) return Promise.resolve(false);
    return caches.delete(item.cacheName);
  }));
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });
  for (const client of clients) {
    client.postMessage(message);
  }
}

async function serveShell(request) {
  const cache = await caches.open(RELEASE.cacheName);
  const cached = await cache.match(RELEASE.shell.url);
  if (cached) return cached;

  try {
    return await fetch(request);
  } catch {
    return new Response(
      "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\">" +
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
      "<title>TechPrimer offline files unavailable</title>" +
      "<body><main><h1>Reconnect to restore offline reading</h1>" +
      "<p>The browser removed one or more cached files.</p></main></body></html>",
      {
        status: 503,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
}

async function serveCurrentAsset(request, asset) {
  const cache = await caches.open(RELEASE.cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetchAndValidate(asset);
  await cache.put(request, response.clone());
  return response;
}

async function servePreviousAsset(request) {
  const names = (await caches.keys())
    .filter(name => name.startsWith(CACHE_PREFIX) && name !== RELEASE.cacheName);

  for (const name of names) {
    const cache = await caches.open(name);
    const response = await cache.match(request);
    if (response) return response;
  }

  return fetch(request);
}

self.addEventListener("install", event => {
  event.waitUntil(installRelease());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await retainCurrentAndPrevious();
    await self.clients.claim();
    await notifyClients({
      type: "RELEASE_ACTIVATED",
      releaseId: RELEASE.id
    });
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    isNetworkOnlyPath(url.pathname)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(serveShell(request));
    return;
  }

  const currentAsset = CURRENT_ASSETS.get(url.href);
  if (currentAsset) {
    event.respondWith(serveCurrentAsset(request, currentAsset));
    return;
  }

  if (url.pathname.startsWith("/assets/") && url.searchParams.has("v")) {
    event.respondWith(servePreviousAsset(request));
  }
});

self.addEventListener("message", event => {
  const message = event.data || {};

  if (message.type === "GET_RELEASE_STATUS") {
    event.ports[0].postMessage({
      type: "RELEASE_STATUS",
      releaseId: RELEASE.id
    });
    return;
  }

  if (message.type === "VERIFY_RELEASE") {
    event.waitUntil((async () => {
      const cache = await caches.open(RELEASE.cacheName);
      const missing = await verifyRelease(cache);
      event.ports[0].postMessage({
        type: "RELEASE_VERIFIED",
        releaseId: RELEASE.id,
        missing
      });
    })());
    return;
  }

  if (
    message.type === "SKIP_WAITING" &&
    message.releaseId === RELEASE.id
  ) {
    self.skipWaiting();
  }
});
