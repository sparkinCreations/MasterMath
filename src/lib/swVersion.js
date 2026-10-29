// Which version a service worker holds, and whether it is news to this page.
//
// The worker's CACHE_NAME is stamped at build time as
// mastermath-v<package version>-<commit> (vite.config.js), and it answers a
// GET_VERSION message with it. Pages are fetched network-first, so a page
// opened after a deploy is already the new version while the new worker is
// still waiting: that worker is not an update for it, and asking the user to
// "update" to what is on screen was the October 2026 complaint (1.59.0).
// Every app change bumps the package version (CLAUDE.md), so the version
// alone says whether a page and a worker are the same app.

export function versionFromCacheName(cacheName) {
  const m = String(cacheName ?? '').match(/^mastermath-v(\d+\.\d+\.\d+)-/);
  return m ? m[1] : null;
}

// 'same' (switch quietly), 'different' (offer the update), or 'unknown'
// (no answer: offer it, as before — never skip an update on a guess).
export function compareWorkerToPage(cacheName, pageVersion) {
  const worker = versionFromCacheName(cacheName);
  if (!worker) return 'unknown';
  return worker === pageVersion ? 'same' : 'different';
}

// Ask a worker for its CACHE_NAME; null if it does not answer in time.
export function askWorkerVersion(worker, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!worker || typeof MessageChannel === 'undefined') { resolve(null); return; }
    const channel = new MessageChannel();
    // The port is closed however this settles: an open port keeps it alive.
    const settle = (value) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => settle(null), timeoutMs);
    channel.port1.onmessage = (event) => settle(event.data?.version ?? null);
    try {
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    } catch {
      settle(null);
    }
  });
}
