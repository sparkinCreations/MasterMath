// MasterMath Service Worker
// by sparkinCreations™
//
// Custom offline-first service worker for MasterMath.
// Strategy: Cache all app assets on install, serve from cache first,
// fall back to network, and update cache in background.
// Math solving is 100% client-side so no API caching is needed —
// we only need to cache the app shell (HTML, JS, CSS, images).

const CACHE_NAME = 'mastermath-v1.2.0';

// Core app shell — these are cached on install
// Vite hashes JS/CSS filenames on build, so we cache them dynamically
// via the fetch handler. These are the known static assets.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/favicon.svg',
];

// Patterns for assets we should cache when fetched
const CACHEABLE_PATTERNS = [
  /\.js$/,
  /\.css$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.svg$/,
  /\.ico$/,
  /\.woff2?$/,
  /\.ttf$/,
  /manifest\.json$/,
];

// Patterns for things we should never cache
const NEVER_CACHE = [
  /\/sw\.js$/,           // Don't cache the service worker itself
  /hot-update/,          // Vite HMR in dev
  /chrome-extension/,
  /localhost.*sockjs/,   // Dev server websocket
];

// ─── INSTALL ────────────────────────────────────────────────
// Cache the app shell immediately so the app works offline
// on the very first visit.
self.addEventListener('install', (event) => {
  console.log('[MasterMath SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[MasterMath SW] Caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => {
        // Skip waiting — activate immediately instead of waiting
        // for all tabs to close. This ensures updates go live fast.
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[MasterMath SW] Install failed:', error);
      })
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────
// Clean up old caches from previous versions.
// This runs when a new service worker takes over.
self.addEventListener('activate', (event) => {
  console.log('[MasterMath SW] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('mastermath-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[MasterMath SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control of all open tabs immediately
        return self.clients.claim();
      })
  );
});

// ─── FETCH ──────────────────────────────────────────────────
// Strategy: Cache-first with network fallback and background update.
//
// 1. Check cache first (fast, works offline)
// 2. If cached: return it AND fetch fresh copy in background (stale-while-revalidate)
// 3. If not cached: fetch from network, cache the response, return it
// 4. If both fail: show offline fallback for navigation requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Only handle same-origin requests (don't cache external APIs, CDNs, etc.)
  if (url.origin !== self.location.origin) return;

  // Don't cache anything in the never-cache list
  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname))) return;

  // Navigation requests (page loads) — serve index.html from cache
  // This makes client-side routing work offline (/solver, /progress, etc.)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html')
        .then((cached) => {
          if (cached) {
            // Revalidate in background
            fetchAndCache(request);
            return cached;
          }
          return fetchAndCache(request);
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets — cache-first with background revalidation
  if (isCacheable(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            // Return cached version immediately
            // Revalidate hashed assets less aggressively (they're immutable)
            if (!isHashedAsset(url.pathname)) {
              fetchAndCache(request);
            }
            return cached;
          }
          // Not in cache — fetch and cache
          return fetchAndCache(request);
        })
        .catch(() => {
          // Network and cache both failed
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
    );
    return;
  }
});

// ─── HELPERS ────────────────────────────────────────────────

// Check if a request path matches cacheable patterns
function isCacheable(pathname) {
  return CACHEABLE_PATTERNS.some((pattern) => pattern.test(pathname));
}

// Check if an asset has a content hash in its filename (Vite adds these)
// e.g., index-BhaDqFn9.js — these never change, so no need to revalidate
function isHashedAsset(pathname) {
  return /\.[a-zA-Z0-9]{8,}\.(js|css)$/.test(pathname) ||
         /assets\/.*-[a-zA-Z0-9]+\.(js|css)$/.test(pathname);
}

// Fetch from network and store in cache
function fetchAndCache(request) {
  return fetch(request)
    .then((response) => {
      // Only cache valid responses
      if (!response || response.status !== 200 || response.type === 'opaque') {
        return response;
      }

      // Clone the response — one for cache, one to return
      const responseToCache = response.clone();

      caches.open(CACHE_NAME)
        .then((cache) => {
          cache.put(request, responseToCache);
        })
        .catch((error) => {
          console.warn('[MasterMath SW] Cache write failed:', error);
        });

      return response;
    });
}

// ─── UPDATE NOTIFICATION ────────────────────────────────────
// When a new version is detected, notify all open tabs
// so the app can prompt the user to refresh.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
