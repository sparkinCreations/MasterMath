import { useEffect, useRef, useState } from 'react';
import pkg from '../../package.json';
import { askWorkerVersion, compareWorkerToPage, versionFromCacheName } from '../lib/swVersion';

// A waiting worker is either the version already on screen (pages load
// network-first, so after a deploy the page is new before the worker is):
// switch to it quietly, no reload, no prompt. Or it is a version this page
// has not loaded (the tab was open across a release): say so in the footer,
// "Update available", and leave it to the reader. Either way the next visit
// is current on its own. (1.59.0; the full-width "Update now" card it
// replaces asked to update to the version already showing.)
export function useServiceWorker() {
  const [update, setUpdate] = useState(null); // { version } when a different version waits
  const [registration, setRegistration] = useState(null);
  // Set when the reader taps the footer link: only then does a change of
  // worker reload this page.
  const asked = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.log('[MasterMath] Service workers not supported');
      return;
    }

    // Don't register in development (Vite dev server handles HMR)
    if (import.meta.env.DEV) {
      console.log('[MasterMath] Skipping SW registration in dev mode');
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[MasterMath] Service worker registered');
        setRegistration(reg);

        // A worker may already be installed and waiting from an earlier page
        // load, and 'updatefound' will not fire again for it.
        if (reg.waiting && navigator.serviceWorker.controller) handleWaiting(reg.waiting);

        // Check for updates periodically (every 30 minutes)
        const interval = setInterval(() => {
          reg.update().catch(() => {});
        }, 30 * 60 * 1000);

        // Listen for a new service worker waiting to activate
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) handleWaiting(newWorker);
          });
        });

        return () => clearInterval(interval);
      })
      .catch((error) => {
        console.error('[MasterMath] SW registration failed:', error);
      });

    // A new worker took over. Reload into it only when the reader asked
    // (tapped the footer link). Never otherwise: the first visit's own worker
    // claiming the page (same version), the quiet switch below (same
    // version), or another tab's update (a newer version: this page shows
    // the footer link instead, and its next visit is current anyway).
    // Reloading unasked threw away whatever the reader had typed.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      if (asked.current) {
        refreshing = true;
        window.location.reload();
        return;
      }
      askWorkerVersion(navigator.serviceWorker.controller).then((cacheName) => {
        if (compareWorkerToPage(cacheName, pkg.version) === 'different') setUpdate({ version: versionFromCacheName(cacheName) });
      });
    });

    function handleWaiting(worker) {
      askWorkerVersion(worker).then((cacheName) => {
        if (compareWorkerToPage(cacheName, pkg.version) === 'same') {
          console.log('[MasterMath] Waiting worker is this version; switching quietly');
          worker.postMessage({ type: 'SKIP_WAITING' });
          return;
        }
        console.log('[MasterMath] A different version is waiting:', cacheName);
        setUpdate({ version: versionFromCacheName(cacheName) });
      });
    }

    // The worker reports a stale shell when a script or stylesheet URL comes
    // back as HTML — the page was built from an index.html that predates a
    // deploy, and its chunks are gone. A reload fetches the current shell
    // (navigations are network-first). Once per page load, so a persistent
    // server problem can never turn into a reload loop.
    const STALE_KEY = 'mastermath:stale-shell-reloaded';
    // Reaching this code means the shell and entry chunk loaded, so the page
    // is healthy; after a grace period, allow a future stale-shell recovery
    // (e.g. after the next deploy) instead of leaving the guard set forever.
    const clearGuard = setTimeout(() => sessionStorage.removeItem(STALE_KEY), 15000);
    const onMessage = (event) => {
      if (event.data?.type !== 'STALE_SHELL') return;
      if (sessionStorage.getItem(STALE_KEY)) {
        console.warn('[MasterMath] Stale shell reported again after reload; not reloading twice.');
        return;
      }
      sessionStorage.setItem(STALE_KEY, '1');
      console.warn('[MasterMath] Stale shell detected, reloading for the current version');
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      clearTimeout(clearGuard);
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  // Apply the waiting update: the worker takes over, controllerchange
  // reloads into it. With no worker waiting, a reload alone fetches the
  // current version (pages are network-first).
  const applyUpdate = () => {
    asked.current = true;
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  return { updateAvailable: Boolean(update), newVersion: update?.version ?? null, applyUpdate };
}
