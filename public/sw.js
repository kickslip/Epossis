/* e-Pos service worker — app-shell + runtime caching for offline use.
 * Mutations are NOT intercepted; the app queues them in IndexedDB and
 * syncs via /api/sync when connectivity returns. */
const VERSION = 'epos-v1'
const STATIC_CACHE = `${VERSION}-static`
const PAGE_CACHE = `${VERSION}-pages`

const PRECACHE = ['/', '/dashboard', '/pos', '/scan', '/products', '/stock', '/sales', '/alerts', '/offline.html']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(PAGE_CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return

  // Static assets: cache-first (immutable Next build output)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(png|jpg|svg|ico|woff2?)$/)) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(e.request)
        if (hit) return hit
        const res = await fetch(e.request)
        if (res.ok) cache.put(e.request, res.clone())
        return res
      }),
    )
    return
  }

  // Data snapshot endpoint: network-first, keep latest in cache for offline
  if (url.pathname === '/api/sync/catalog') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(PAGE_CACHE).then((c) => c.put(e.request, res.clone()))
          return res
        })
        .catch(() => caches.match(e.request)),
    )
    return
  }

  // Page navigations: network-first, fall back to cached copy
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(PAGE_CACHE).then((c) => c.put(e.request, res.clone()))
          return res
        })
        .catch(async () => {
          const cached = await caches.match(e.request)
          return cached || caches.match('/offline.html')
        }),
    )
    return
  }

  // Other GETs (e.g. /api/files images): stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok && url.pathname.startsWith('/api/files/')) {
            caches.open(STATIC_CACHE).then((c) => c.put(e.request, res.clone()))
          }
          return res
        }),
    ),
  )
})
