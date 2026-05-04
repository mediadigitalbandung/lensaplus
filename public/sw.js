// Kartawarta Service Worker — lite custom PWA
// Strategy: cache-first static, cache-first images, network-first HTML

const CACHE_VERSION = 'v2';
const STATIC_CACHE  = 'kartawarta-static-' + CACHE_VERSION;
const IMAGE_CACHE   = 'kartawarta-images-' + CACHE_VERSION;
const PAGE_CACHE    = 'kartawarta-pages-'  + CACHE_VERSION;

const OFFLINE_URL   = '/offline';

// Max entries / bytes per cache
const IMAGE_MAX_ENTRIES = 60;
const IMAGE_MAX_BYTES   = 50 * 1024 * 1024; // 50 MB
const PAGE_MAX_ENTRIES  = 30;

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, IMAGE_CACHE, PAGE_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !validCaches.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Trim a cache to max N entries (LRU eviction — oldest first by insertion). */
async function trimCacheEntries(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map((k) => cache.delete(k)));
  }
}

/** Trim a cache to max N bytes (oldest entries evicted first). */
async function trimCacheSize(cacheName, maxBytes) {
  const cache    = await caches.open(cacheName);
  const keys     = await cache.keys();
  let totalBytes = 0;
  const entries  = [];

  for (const key of keys) {
    const resp = await cache.match(key);
    if (!resp) continue;
    const clone = resp.clone();
    const buf   = await clone.arrayBuffer();
    totalBytes += buf.byteLength;
    entries.push({ key, size: buf.byteLength });
  }

  if (totalBytes <= maxBytes) return;

  // Evict oldest (front of keys array) until under budget
  for (const entry of entries) {
    if (totalBytes <= maxBytes) break;
    await cache.delete(entry.key);
    totalBytes -= entry.size;
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin or kartawarta.com requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Skip panel/* — admin routes should never be cached
  if (url.pathname.startsWith('/panel/')) return;

  // Skip API routes
  if (url.pathname.startsWith('/api/')) return;

  // 1. Static Next.js assets — cache-first, 30 days
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 2. Uploaded images — cache-first, 7 days
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      cacheFirst(request, IMAGE_CACHE).then(async (resp) => {
        await trimCacheEntries(IMAGE_CACHE, IMAGE_MAX_ENTRIES);
        await trimCacheSize(IMAGE_CACHE, IMAGE_MAX_BYTES);
        return resp;
      })
    );
    return;
  }

  // 3. HTML navigation — network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }
});

/** Cache-first: serve from cache; on miss fetch, store, and return. */
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first: try network; on failure serve cache or offline page. */
async function networkFirstWithFallback(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      await trimCacheEntries(PAGE_CACHE, PAGE_MAX_ENTRIES);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Last resort: offline page
    const offline = await caches.match(OFFLINE_URL, { cacheName: STATIC_CACHE });
    return offline || new Response('Anda sedang offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
