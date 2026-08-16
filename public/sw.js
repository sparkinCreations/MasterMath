// MasterMath Service Worker
// by sparkinCreations™
//
// Custom offline-first service worker for MasterMath.
// Strategy: Cache all app assets on install, serve from cache first,
// fall back to network, and update cache in background.
// Math solving is 100% client-side so no API caching is needed —
// we only need to cache the app shell (HTML, JS, CSS, images).

// The build stamps this with the package version plus the commit hash
// (see stampServiceWorker in vite.config.js). Browsers only detect an
// update when this file's bytes change, so the stamp is what makes the
// in-app update banner fire on every release. The placeholder below is
// only ever served if the file somehow ships unbuilt.
const CACHE_NAME = 'mastermath-v0-unstamped';

// Core app shell — these are cached on install. These are the known,
// unhashed static files.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/favicon.svg',
];

// Every hashed asset the build produced — route chunks, the lazily loaded
// solver modules and maths libraries, stylesheets, and the KaTeX fonts.
// Filled in at build time by stampServiceWorker (vite.config.js), because
// the filenames carry content hashes and are only known once Vite has run.
// Precaching all of it is what makes "works offline" true for every route:
// the routes are code-split, so a route you had not yet opened while online
// would otherwise have nothing to load from. The placeholder below is what
// ships if sw.js is somehow served unbuilt; it degrades to caching on fetch.
const PRECACHE_ASSETS = [/* __PRECACHE_ASSETS__ */];

// Cache lookups ignore the Vary header. Servers commonly send `Vary: Origin`
// on static files, and Vite's <link rel="modulepreload"> requests carry an
// Origin header while the worker's own precache fetches do not — so a strict
// match would refuse the very entries the precache just stored, and an
// offline route load would 503 with the file sitting right there in the
// cache. Everything cached here is either content-addressed (hashed assets)
// or the single app shell; the same bytes are correct for every requester.
const MATCH_OPTS = { ignoreVary: true };

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
        // The shell is required: if it can't be cached, install fails and
        // the browser retries later, which is the right outcome.
        return cache.addAll(APP_SHELL).then(() => cache);
      })
      .then((cache) => precacheAssets(cache))
      // Note: no self.skipWaiting() here. The new worker stays in the
      // "waiting" state so the app can show its update banner; it only
      // activates when the user clicks Update (the SKIP_WAITING message
      // below) or when every tab is closed. Activating immediately would
      // trigger the controllerchange auto-reload mid-session.
      .catch((error) => {
        console.error('[MasterMath SW] Install failed:', error);
        throw error;
      })
  );
});

// Fill the new cache with the build's hashed assets.
//
// Two deliberate choices:
//  - Assets are fetched individually and failures are tolerated. Precaching
//    is best-effort — a single miss (a deploy racing this install, a flaky
//    connection) must not brick the whole install; the fetch handler still
//    caches anything missing the first time it is requested online.
//  - Unchanged assets are copied from the previous worker's cache instead
//    of re-downloaded. Hashed filenames are content-addressed, so a name
//    that already exists in an older cache is byte-identical. mathjs,
//    Algebrite and Recharts rarely change between releases; without this,
//    every deploy would cost every user a fresh ~1 MB download.
function precacheAssets(cache) {
  if (!PRECACHE_ASSETS.length) return;
  console.log('[MasterMath SW] Precaching', PRECACHE_ASSETS.length, 'assets');

  let reused = 0;
  let fetched = 0;
  let failed = 0;

  return Promise.all(
    PRECACHE_ASSETS.map((url) =>
      caches.match(url, MATCH_OPTS)
        .then((existing) => {
          if (existing && bodyMatchesPath(url, existing)) {
            reused += 1;
            return cache.put(url, existing);
          }
          return fetch(url).then((response) => {
            if (!response || response.status !== 200 || !bodyMatchesPath(url, response)) {
              failed += 1;
              return;
            }
            fetched += 1;
            return cache.put(url, response);
          });
        })
        .catch(() => {
          failed += 1;
        })
    )
  ).then(() => {
    console.log(`[MasterMath SW] Precache done — ${fetched} fetched, ${reused} reused, ${failed} skipped`);
  });
}

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
        // Re-fetch the shell now. This worker's install may have run
        // before a later deploy (it waits for the user's Update click or
        // for all tabs to close), so the index.html it cached at install
        // can already be out of date by the time it takes over. Best
        // effort: if offline, keep whatever is cached.
        return caches.open(CACHE_NAME).then((cache) =>
          fetch('/index.html', { cache: 'no-store' })
            .then((response) => {
              if (response && response.ok) return cache.put('/index.html', response);
            })
            .catch(() => {})
        );
      })
      .then(() => {
        // Take control of all open tabs immediately
        return self.clients.claim();
      })
  );
});

// ─── FETCH ──────────────────────────────────────────────────
// Strategy:
//   Navigations (the HTML shell)  → NETWORK-FIRST, cached copy when offline.
//   Static assets (hashed JS/CSS) → cache-first, network fallback.
//
// Why the shell is network-first: index.html is a few KB, and it is the one
// file that must agree with what's on the server. Every deploy replaces the
// hashed chunk filenames, and Netlify removes the old ones. A cached shell
// that outlives a deploy therefore points at chunks that no longer exist,
// and — because netlify.toml rewrites every unknown path to index.html with
// a 200 — a request for a vanished chunk comes back as HTML. The browser
// refuses to run HTML as a module script and the page renders blank, with
// nothing red in the console. Serving the shell cache-first is what let that
// happen (and the "background revalidation" never refreshed the entry that
// navigations actually read). Network-first makes the shell always match the
// chunks that exist; the cache is only for genuinely offline use.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Only handle same-origin requests (don't cache external APIs, CDNs, etc.)
  if (url.origin !== self.location.origin) return;

  // Don't cache anything in the never-cache list
  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname))) return;

  // Navigation requests (page loads): network-first.
  // Every route serves the same shell (client-side routing), so the fresh
  // copy is stored under the single '/index.html' key that offline
  // fallbacks read — regardless of which URL was navigated to.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put('/index.html', copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match('/index.html', MATCH_OPTS).then(
            (cached) =>
              cached ||
              new Response('You appear to be offline and MasterMath has not been cached yet.', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
              })
          )
        )
    );
    return;
  }

  // Static assets — cache-first with background revalidation
  if (isCacheable(url.pathname)) {
    event.respondWith(
      caches.match(request, MATCH_OPTS)
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

// The body type each asset kind must come back with. Netlify's SPA rewrite
// answers any unknown path with index.html and a 200, so a request for a
// chunk that no longer exists on the server "succeeds" with an HTML body.
// Caching that would poison the entry for that URL for the life of the
// worker (hashed assets are never revalidated). A response whose body type
// doesn't match its filename is never trusted.
const EXPECTED_TYPES = [
  { pattern: /\.m?js$/, type: /javascript|ecmascript/i },
  { pattern: /\.css$/, type: /text\/css/i },
  { pattern: /\.(png|jpe?g|svg|ico|woff2?|ttf)$/, type: /image|font|octet-stream|svg/i },
  { pattern: /manifest\.json$/, type: /json/i },
];

function bodyMatchesPath(pathname, response) {
  const rule = EXPECTED_TYPES.find((r) => r.pattern.test(pathname));
  if (!rule) return true;
  const type = response.headers.get('content-type') || '';
  return rule.type.test(type);
}

// Fetch from network and store in cache
function fetchAndCache(request) {
  return fetch(request)
    .then((response) => {
      // Only cache valid responses
      if (!response || response.status !== 200 || response.type === 'opaque') {
        return response;
      }

      const pathname = new URL(request.url).pathname;
      if (!bodyMatchesPath(pathname, response)) {
        // A script or stylesheet URL answered with the HTML shell means the
        // shell that requested it is stale (it predates a deploy). Don't
        // cache it, and tell open tabs to reload: with network-first
        // navigation the reload fetches the current shell, whose chunks
        // exist. Guarded against loops on the client side.
        if (/\.(m?js|css)$/.test(pathname)) {
          console.warn('[MasterMath SW] Stale shell detected — asset came back as', response.headers.get('content-type'), pathname);
          notifyClients({ type: 'STALE_SHELL', asset: pathname });
        }
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

function notifyClients(message) {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => clients.forEach((client) => client.postMessage(message)))
    .catch(() => {});
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
