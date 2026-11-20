// Lensaplus Service Worker — PWA offline caching + Web Push notifications
// Strategy: cache-first static, cache-first images, network-first HTML

const CACHE_VERSION = 'v3';
const STATIC_CACHE  = 'lensaplus-static-' + CACHE_VERSION;
const IMAGE_CACHE   = 'lensaplus-images-' + CACHE_VERSION;
const PAGE_CACHE    = 'lensaplus-pages-'  + CACHE_VERSION;

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
  '/lensaplus-icon-96.png',
  '/lensaplus-icon-192.png',
  '/lensaplus-icon-512.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE_ASSETS.map((url) => cache.add(url))))
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

  // Only handle same-origin or lensaplus.com requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Skip panel/* — admin routes should never be cached
  if (url.pathname.startsWith('/panel/')) return;

  // Skip API routes
  if (url.pathname.startsWith('/api/')) return;

  // 1. Static Next.js assets — cache-first, 30 days
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, event));
    return;
  }

  // 2. Uploaded images & icons — cache-first, 7 days
  if (
    url.pathname.startsWith('/uploads/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/lensaplus-icon')
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, event));
    return;
  }

  // 3. HTML navigation — network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request, event));
    return;
  }
});

/** Cache-first: serve from cache (or precache); on miss fetch, store, and return. */
async function cacheFirst(request, cacheName, event) {
  const cache  = await caches.open(cacheName);
  const cached = (await cache.match(request)) || (await caches.match(request));
  if (cached) return cached;

  const response = await fetch(request);
  if (response.status === 200 && !request.headers.has('range')) {
    const clone = response.clone();
    const persistAndTrim = (async () => {
      await cache.put(request, clone);
      if (cacheName === IMAGE_CACHE) {
        await trimCacheEntries(IMAGE_CACHE, IMAGE_MAX_ENTRIES);
        await trimCacheSize(IMAGE_CACHE, IMAGE_MAX_BYTES);
      }
    })();
    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(persistAndTrim);
    } else {
      await persistAndTrim;
    }
  }
  return response;
}

/** Network-first: try network; on failure serve cache or offline page. */
async function networkFirstWithFallback(request, event) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response.status === 200 && !request.headers.has('range')) {
      const clone = response.clone();
      const persistAndTrim = (async () => {
        await cache.put(request, clone);
        await trimCacheEntries(PAGE_CACHE, PAGE_MAX_ENTRIES);
      })();
      if (event && typeof event.waitUntil === 'function') {
        event.waitUntil(persistAndTrim);
      } else {
        await persistAndTrim;
      }
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

// ── Web Push Notifications ───────────────────────────────────────────────────
function resolveNotificationUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl || '/', self.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // ignore invalid URL
  }
  return self.location.origin;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Lensaplus', body: event.data.text() };
  }
  const { title, body, url, icon, badge, image, tag } = payload;
  const targetUrl = resolveNotificationUrl(url);
  event.waitUntil(
    self.registration.showNotification(title || 'Lensaplus', {
      body: body || '',
      icon: icon || '/lensaplus-icon-192.png',
      badge: badge || '/lensaplus-icon-96.png',
      image: image || undefined,
      tag: tag || undefined,
      data: { url: targetUrl },
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = resolveNotificationUrl(event.notification.data?.url);
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      }),
  );
});
