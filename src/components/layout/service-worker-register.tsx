'use client';

import { useEffect } from 'react';

/// Registers the PWA service worker on the client (production only to avoid dev caching issues).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Register only in production to avoid caching surprises during dev.
    if (process.env.NODE_ENV !== 'production') return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silent — service worker is an enhancement, not a requirement.
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
