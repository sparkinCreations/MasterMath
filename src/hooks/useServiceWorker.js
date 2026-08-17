import { useEffect, useState } from 'react';

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);

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

        // A new version may already be installed and waiting from an earlier
        // page load — the user saw the banner, reloaded instead of clicking
        // it, and 'updatefound' will not fire again for a worker that is
        // already installed. Offer it again.
        if (reg.waiting && navigator.serviceWorker.controller) {
          console.log('[MasterMath] New version already waiting');
          setUpdateAvailable(true);
        }

        // Check for updates periodically (every 30 minutes)
        const interval = setInterval(() => {
          reg.update().catch(() => {});
        }, 30 * 60 * 1000);

        // Listen for a new service worker waiting to activate
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // New version installed and waiting — notify the user
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[MasterMath] New version available');
              setUpdateAvailable(true);
            }
          });
        });

        return () => clearInterval(interval);
      })
      .catch((error) => {
        console.error('[MasterMath] SW registration failed:', error);
      });

    // Handle controller change (new SW took over) — reload to get fresh assets
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

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

  // Call this to apply the waiting update
  const applyUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return { updateAvailable, applyUpdate };
}
