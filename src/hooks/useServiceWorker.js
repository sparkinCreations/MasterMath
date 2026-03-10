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
  }, []);

  // Call this to apply the waiting update
  const applyUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return { updateAvailable, applyUpdate };
}
