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
      .then((cache) => Promise.resolve(precacheAssets(cache)).then(() => cache))
      // Normally there is no self.skipWaiting() here. The new worker stays in
      // the "waiting" state so the app can show its update banner; it only
      // activates when the user clicks Update (the SKIP_WAITING message
      // below) or when every tab is closed. Activating immediately would
      // trigger the controllerchange auto-reload mid-session.
      //
      // The one exception is a predecessor we can prove is already serving a
      // broken app (see needsRecovery). That user cannot click the update
      // banner, because the banner is drawn by a bundle that never loads —
      // so waiting for a click that can never come just keeps them stuck on a
      // blank page until they close every tab. For them, and only for them,
      // we take over immediately and reload their windows from activate.
      .then((cache) =>
        needsRecovery().then((broken) => {
          if (!broken) return;
          console.warn('[MasterMath SW] Broken predecessor detected — activating immediately');
          // Recorded in the cache rather than a variable: the browser may
          // terminate and restart this worker between install and activate,
          // which would lose module scope.
          return cache
            .put(RECOVERY_MARKER, new Response('1'))
            .then(() => self.skipWaiting());
        })
      )
      .catch((error) => {
        console.error('[MasterMath SW] Install failed:', error);
        throw error;
      })
  );
});

// Internal key, never requested by a page (no file extension, so isCacheable
// is false and the fetch handler never intercepts it).
const RECOVERY_MARKER = '/__mastermath_recovery__';

// Should this worker take over without waiting for an Update click?
//
// Only when the *predecessor* is provably serving a broken app. Getting this
// wrong in the permissive direction would reload healthy users mid-session —
// exactly what staying in "waiting" exists to prevent — so both signals below
// are fingerprints of the pre-1.14.1 worker specifically, not of a stale cache
// in general. Every deploy leaves a stale cache behind; that is normal and
// harmless, because 1.14.1+ serves navigations network-first and never reads
// the old shell.
//
//  - Poison: an entry whose body type contradicts its filename. Only a worker
//    without the bodyMatchesPath guard could have written it, and it is served
//    to the page as HTML-for-a-module-script.
//  - A route URL used as a cache key (`/solver`, `/faq`). The old worker
//    background-revalidated navigations through fetchAndCache, which stores
//    under the *navigated* URL; 1.14.1+ only ever writes '/index.html'. On its
//    own this is harmless, so it counts only together with a shell that points
//    at chunks this build does not have — that worker serves that shell
//    cache-first, so it is about to ask for chunks the server deleted.
function needsRecovery() {
  if (!PRECACHE_ASSETS.length) return Promise.resolve(false);
  const current = new Set(PRECACHE_ASSETS);

  return caches.keys()
    .then((names) => {
      const older = names.filter((n) => n.startsWith('mastermath-') && n !== CACHE_NAME);
      // Sequential and short-circuiting: this runs during install, and one
      // hit is enough.
      return older.reduce(
        (chain, name) => chain.then((broken) => (broken ? true : inspectCache(name, current))),
        Promise.resolve(false)
      );
    })
    .catch(() => false);
}

function inspectCache(name, current) {
  return caches.open(name)
    .then((cache) =>
      Promise.all([cache.keys(), readShell(cache)]).then(([keys, html]) => {
        const paths = keys.map((req) => new URL(req.url).pathname);
        const routeKeys = paths.filter(looksLikeRouteEntry);
        const refs = html ? shellAssetRefs(html) : [];
        const shellIsStale = refs.length > 0 && refs.some((ref) => !current.has(ref));

        if (routeKeys.length && shellIsStale) return true;

        // Poison check last: it costs a match() per candidate.
        const candidates = paths.filter((p) => /\.(m?js|css)$/.test(p));
        return candidates.reduce(
          (chain, p) =>
            chain.then((bad) =>
              bad
                ? true
                : cache
                    .match(p, MATCH_OPTS)
                    .then((res) => !!res && !bodyMatchesPath(p, res))
                    .catch(() => false)
            ),
          Promise.resolve(false)
        );
      })
    )
    .catch(() => false);
}

function readShell(cache) {
  return cache
    .match('/index.html', MATCH_OPTS)
    .then((res) => res || cache.match('/', MATCH_OPTS))
    .then((res) => (res ? res.text() : null))
    .catch(() => null);
}

// The hashed chunks a cached shell will ask for: the module entry plus its
// modulepreloads.
function shellAssetRefs(html) {
  const refs = [];
  const pattern = /(?:src|href)="(\/assets\/[^"]+\.js)"/g;
  let match;
  while ((match = pattern.exec(html)) !== null) refs.push(match[1]);
  return refs;
}

// A cache key that is a route rather than a file — no extension on the last
// segment, and not one of the shell's own entries.
function looksLikeRouteEntry(pathname) {
  if (APP_SHELL.indexOf(pathname) !== -1) return false;
  const last = pathname.split('/').pop();
  return last !== '' && last.indexOf('.') === -1;
}

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
    // Read the install-time verdict before the caches it was based on go away.
    takeRecoveryMarker().then((recovering) =>
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
        .then(() => (recovering ? reloadStuckWindows() : undefined))
    )
  );
});

// Read and consume the install-time recovery verdict.
function takeRecoveryMarker() {
  return caches.open(CACHE_NAME)
    .then((cache) =>
      cache.match(RECOVERY_MARKER).then((hit) => {
        if (!hit) return false;
        return cache.delete(RECOVERY_MARKER).then(() => true);
      })
    )
    .catch(() => false);
}

// Reload the windows we just claimed.
//
// Only reached when install proved the predecessor was serving a broken app.
// Claiming alone is not enough to fix those tabs: the page is blank precisely
// because no script of ours is running in it, so there is nothing left to
// notice the controller change and reload itself. navigate() is the only way
// back for a window whose JavaScript never started.
//
// This reloads every window, not just the blank ones. A tab that still looks
// healthy is running on the same doomed shell — its chunks are already gone
// from the server — so it would break at the next lazy route anyway. There is
// no reliable way to ask a page whether it is alive: a healthy tab on the old
// shell runs the *old* bundle, which has no listener to answer with.
function reloadStuckWindows() {
  return self.clients.matchAll({ type: 'window' })
    .then((clients) =>
      Promise.all(
        clients.map((client) => {
          if (typeof client.navigate !== 'function') return undefined;
          console.warn('[MasterMath SW] Reloading stuck window:', client.url);
          return Promise.resolve(client.navigate(client.url)).catch(() => {});
        })
      )
    )
    .catch(() => {});
}

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
          // Own cache only — an older worker's cache may hold a shell whose
          // chunks the server deleted several deploys ago.
          caches.open(CACHE_NAME).then((cache) => cache.match('/index.html', MATCH_OPTS)).then(
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

  // Static assets — cache-first with background revalidation.
  //
  // Two guards here, both learned the hard way:
  //
  //  - Read from *this worker's* cache, not the global CacheStorage. A bare
  //    caches.match() searches every cache in the origin, oldest first, so a
  //    cache left by a worker that predates the bodyMatchesPath guard (≤1.14.0
  //    happily stored Netlify's HTML rewrite under a .js URL) could answer a
  //    request that this worker's own cache had no entry for — a precache miss
  //    is enough, since precacheAssets tolerates failures.
  //  - Validate on read, not only on write. A cached entry whose body type
  //    contradicts its filename is poison inherited from such a worker: drop
  //    it, tell the tabs, and go to the network. Without this the page is
  //    handed HTML for a module script and renders blank with a silent
  //    console, because nothing on the cache-hit path ever checked.
  if (isCacheable(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME)
        .then((cache) => cache.match(request, MATCH_OPTS))
        .then((cached) => {
          if (cached && !bodyMatchesPath(url.pathname, cached)) {
            console.warn('[MasterMath SW] Poisoned cache entry —', cached.headers.get('content-type'), 'for', url.pathname);
            caches.open(CACHE_NAME)
              .then((cache) => cache.delete(request, MATCH_OPTS))
              .catch(() => {});
            if (/\.(m?js|css)$/.test(url.pathname)) {
              notifyClients({ type: 'STALE_SHELL', asset: url.pathname });
            }
            return fetchAndCache(request);
          }
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
