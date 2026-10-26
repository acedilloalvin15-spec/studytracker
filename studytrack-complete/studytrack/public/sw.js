/* StudyTrack service worker: keeps the app usable when there is no internet. */
const VERSION = 'v1'
const STATIC_CACHE = `studytrack-static-${VERSION}`
const PAGE_CACHE = `studytrack-pages-${VERSION}`
const OFFLINE_URL = '/offline'
const MAX_PAGES = 40
const NETWORK_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => Promise.allSettled([OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/images/hero-student.png'].map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, PAGE_CACHE]
      for (const key of await caches.keys()) {
        if (key.startsWith('studytrack-') && !keep.includes(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname)

  if (isStatic) {
    event.respondWith(cacheFirst(req))
  } else if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req))
  }
})

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(req)
  if (hit) return hit
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch {
    return Response.error()
  }
}

function fetchWithTimeout(req, ms) {
  if (!ms) return fetch(req)
  return Promise.race([fetch(req), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGE_CACHE)
  const cached = await cache.match(req.url, { ignoreVary: true })
  try {
    // With a saved copy, give up on a slow network after a few seconds and show the saved page.
    const res = await fetchWithTimeout(req, cached ? NETWORK_TIMEOUT_MS : 0)
    const isHtml = (res.headers.get('content-type') || '').includes('text/html')
    if (res.ok && !res.redirected && isHtml) {
      cache.put(req.url, res.clone()).then(() => trimCache(cache))
    }
    return res
  } catch {
    if (cached) return cached
    const offline = await caches.match(OFFLINE_URL)
    return offline || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function trimCache(cache) {
  const keys = await cache.keys()
  if (keys.length > MAX_PAGES) {
    await Promise.all(keys.slice(0, keys.length - MAX_PAGES).map((k) => cache.delete(k)))
  }
}
