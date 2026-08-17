import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SW_SOURCE = fs.readFileSync(path.resolve(here, '../public/sw.js'), 'utf8');

// ── The service worker decides at install time whether to skip "waiting" and
// take over immediately. It must do that only for a predecessor that is
// provably serving a broken app: activating early reloads the user's windows,
// which is exactly what the waiting state exists to avoid.
//
// The false positive is the dangerous direction, and it is easy to write by
// accident — every deploy leaves behind a cache whose shell points at the
// previous build's chunks. That is normal. These tests pin the difference
// between "stale, and fine" and "stale, and about to serve a blank page".

const ORIGIN = 'https://mastermath.app';

// Minimal CacheStorage. Entries are [path, contentType] pairs; bodies only
// matter to the extent that the shell's HTML is parsed for chunk references.
function makeCaches(spec) {
  const store = new Map();
  for (const [cacheName, entries] of Object.entries(spec)) {
    const cache = new Map();
    for (const [pathname, meta] of Object.entries(entries)) {
      cache.set(pathname, {
        headers: { get: (h) => (h.toLowerCase() === 'content-type' ? meta.type : null) },
        text: () => Promise.resolve(meta.body || ''),
      });
    }
    store.set(cacheName, cache);
  }

  const wrap = (cache) => ({
    keys: () =>
      Promise.resolve([...cache.keys()].map((p) => ({ url: ORIGIN + p }))),
    match: (key) => Promise.resolve(cache.get(typeof key === 'string' ? key : key.url) || undefined),
    put: (key, value) => { cache.set(key, value); return Promise.resolve(); },
    delete: (key) => Promise.resolve(cache.delete(key)),
    addAll: (urls) => {
      urls.forEach((u) => cache.set(u, { headers: { get: () => 'text/html' }, text: () => Promise.resolve('') }));
      return Promise.resolve();
    },
  });

  return {
    keys: () => Promise.resolve([...store.keys()]),
    open: (name) => {
      if (!store.has(name)) store.set(name, new Map());
      return Promise.resolve(wrap(store.get(name)));
    },
    delete: (name) => Promise.resolve(store.delete(name)),
    match: () => Promise.resolve(undefined),
  };
}

// Evaluate sw.js in a scope that satisfies its globals, then hand back the
// internals under test. The build stamps CACHE_NAME and PRECACHE_ASSETS, so
// the test stamps them the same way.
function loadWorker({ caches, precache, openWindows }) {
  const source = SW_SOURCE
    .replace(/const CACHE_NAME = '[^']*'/, `const CACHE_NAME = 'mastermath-v9.9.9-current'`)
    .replace(/const PRECACHE_ASSETS = \[[^\]]*\];/, `const PRECACHE_ASSETS = ${JSON.stringify(precache)};`);

  const handlers = {};
  const spy = { skipWaiting: 0, claimed: 0, navigated: [] };
  const windows = (openWindows || []).map((url) => ({
    url,
    navigate(target) { spy.navigated.push(target); return Promise.resolve(); },
  }));

  const context = {
    self: {
      addEventListener(type, fn) { handlers[type] = fn; },
      skipWaiting: () => { spy.skipWaiting += 1; return Promise.resolve(); },
      clients: {
        claim: () => { spy.claimed += 1; return Promise.resolve(); },
        matchAll: () => Promise.resolve(windows),
      },
      location: { origin: ORIGIN },
    },
    caches,
    URL,
    Response: class { constructor(body) { this.body = body; } },
    fetch: () => Promise.reject(new Error('no network in this test')),
    console: { log() {}, warn() {}, error() {} },
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  // Drive a lifecycle event the way the browser does, awaiting waitUntil.
  context.dispatch = (type) => {
    let work = Promise.resolve();
    handlers[type]({ waitUntil: (p) => { work = p; } });
    return work;
  };
  context.spy = spy;
  return context;
}

const CURRENT_BUILD = ['/assets/index-NEW00001.js', '/assets/vendor-NEW00002.js'];

const shell = (chunk) => ({
  type: 'text/html; charset=UTF-8',
  body: `<!doctype html><html><body><div id="root"></div>` +
        `<script type="module" crossorigin src="${chunk}"></script></body></html>`,
});

const js = { type: 'application/javascript; charset=UTF-8' };
const htmlBody = { type: 'text/html; charset=UTF-8' };

function check(spec, precache = CURRENT_BUILD) {
  const { needsRecovery } = loadWorker({ caches: makeCaches(spec), precache });
  return needsRecovery();
}

test('a first install with no previous cache does not force activation', async () => {
  assert.equal(await check({}), false);
});

test('an ordinary upgrade does not force activation, though its shell is stale', async () => {
  // The 1.14.1+ worker only ever writes '/index.html' for navigations, so the
  // cache holds no route keys. Its shell points at the previous build's chunks
  // — normal, and never served, because navigations are network-first.
  const result = await check({
    'mastermath-v9.9.8-previous': {
      '/index.html': shell('/assets/index-OLD00001.js'),
      '/assets/index-OLD00001.js': js,
      '/assets/vendor-OLD00002.js': js,
    },
  });
  assert.equal(result, false);
});

test('a pre-1.14.1 cache whose shell still matches this build does not force activation', async () => {
  // Route keys betray the old worker, but its shell points at chunks that
  // still exist, so nothing is broken yet.
  const result = await check({
    'mastermath-v1.13.3-old': {
      '/index.html': shell('/assets/index-NEW00001.js'),
      '/solver': { type: 'text/html; charset=UTF-8' },
      '/assets/index-NEW00001.js': js,
    },
  });
  assert.equal(result, false);
});

test('a pre-1.14.1 cache serving a shell whose chunks are gone forces activation', async () => {
  // Route keys (old worker: caches navigations under the navigated URL) plus a
  // shell pointing at a chunk this build does not have. That worker serves
  // that shell cache-first, so the next load asks for a deleted chunk.
  const result = await check({
    'mastermath-v1.13.3-old': {
      '/index.html': shell('/assets/index-OLD00001.js'),
      '/solver': { type: 'text/html; charset=UTF-8' },
      '/progress': { type: 'text/html; charset=UTF-8' },
      '/assets/index-OLD00001.js': js,
    },
  });
  assert.equal(result, true);
});

test('a poisoned entry forces activation on its own', async () => {
  // An HTML body stored under a .js key: only a worker without the
  // bodyMatchesPath guard could have written it.
  const result = await check({
    'mastermath-v1.13.3-old': {
      '/index.html': shell('/assets/index-NEW00001.js'),
      '/assets/index-NEW00001.js': htmlBody,
    },
  });
  assert.equal(result, true);
});

test('a poisoned stylesheet counts too', async () => {
  const result = await check({
    'mastermath-v1.13.3-old': {
      '/index.html': shell('/assets/index-NEW00001.js'),
      '/assets/index-OLD00003.css': htmlBody,
    },
  });
  assert.equal(result, true);
});

test('an unstamped worker never forces activation', async () => {
  // If sw.js somehow ships unbuilt, PRECACHE_ASSETS is empty and every chunk
  // would look missing. Guessing "broken" there would reload everyone.
  const result = await check(
    {
      'mastermath-v1.13.3-old': {
        '/index.html': shell('/assets/index-OLD00001.js'),
        '/solver': { type: 'text/html; charset=UTF-8' },
      },
    },
    []
  );
  assert.equal(result, false);
});

test('caches belonging to other apps on the origin are ignored', async () => {
  const result = await check({
    'someone-elses-cache': {
      '/index.html': shell('/assets/index-OLD00001.js'),
      '/solver': { type: 'text/html; charset=UTF-8' },
    },
  });
  assert.equal(result, false);
});

// ── install → activate handoff. The verdict is recorded in the cache rather
// than a variable because the browser may terminate and restart the worker
// between the two events.

const BROKEN_PREDECESSOR = {
  'mastermath-v1.13.3-old': {
    '/index.html': shell('/assets/index-OLD00001.js'),
    '/solver': { type: 'text/html; charset=UTF-8' },
    '/assets/index-OLD00001.js': js,
  },
};

const HEALTHY_PREDECESSOR = {
  'mastermath-v9.9.8-previous': {
    '/index.html': shell('/assets/index-OLD00001.js'),
    '/assets/index-OLD00001.js': js,
  },
};

test('a broken predecessor: install takes over and activate reloads the windows', async () => {
  const sw = loadWorker({
    caches: makeCaches(BROKEN_PREDECESSOR),
    precache: CURRENT_BUILD,
    openWindows: [`${ORIGIN}/solver`, `${ORIGIN}/progress`],
  });

  await sw.dispatch('install');
  assert.equal(sw.spy.skipWaiting, 1, 'install should skip waiting');

  await sw.dispatch('activate');
  assert.equal(sw.spy.claimed, 1);
  assert.deepEqual(sw.spy.navigated, [`${ORIGIN}/solver`, `${ORIGIN}/progress`],
    'each stuck window should be reloaded at its own URL');
});

test('a healthy predecessor: install waits and activate touches no window', async () => {
  const sw = loadWorker({
    caches: makeCaches(HEALTHY_PREDECESSOR),
    precache: CURRENT_BUILD,
    openWindows: [`${ORIGIN}/solver`],
  });

  await sw.dispatch('install');
  assert.equal(sw.spy.skipWaiting, 0, 'the update banner must get its chance');

  await sw.dispatch('activate');
  assert.equal(sw.spy.claimed, 1, 'claiming is unconditional and always was');
  assert.deepEqual(sw.spy.navigated, [], 'no mid-session reload for a healthy app');
});

test('the recovery marker is consumed, so a later activate does not reload again', async () => {
  const caches = makeCaches(BROKEN_PREDECESSOR);
  const sw = loadWorker({ caches, precache: CURRENT_BUILD, openWindows: [`${ORIGIN}/`] });

  await sw.dispatch('install');
  await sw.dispatch('activate');
  assert.equal(sw.spy.navigated.length, 1);

  await sw.dispatch('activate');
  assert.equal(sw.spy.navigated.length, 1, 'the marker should not survive the first activate');
});

test('the marker never leaks into the served cache as a real entry', async () => {
  const caches = makeCaches(BROKEN_PREDECESSOR);
  const sw = loadWorker({ caches, precache: CURRENT_BUILD, openWindows: [] });

  await sw.dispatch('install');
  await sw.dispatch('activate');

  const cache = await caches.open('mastermath-v9.9.9-current');
  const keys = (await cache.keys()).map((r) => new URL(r.url).pathname);
  assert.ok(!keys.some((k) => k.includes('recovery')), `marker left behind: ${keys}`);
});

test('a cache read failure is treated as healthy, not as breakage', async () => {
  const brokenCaches = {
    keys: () => Promise.resolve(['mastermath-v1.13.3-old']),
    open: () => Promise.reject(new Error('storage unavailable')),
    delete: () => Promise.resolve(true),
    match: () => Promise.resolve(undefined),
  };
  const { needsRecovery } = loadWorker({ caches: brokenCaches, precache: CURRENT_BUILD });
  assert.equal(await needsRecovery(), false);
});
