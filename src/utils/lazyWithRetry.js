import { lazy } from 'react';

const CHUNK_RELOAD_KEY = 'medici-chunk-reload';

/**
 * Wrap React.lazy so a stale cached main bundle (referencing deleted chunk files
 * after deploy) triggers one automatic hard reload instead of a broken screen.
 */
export function lazyWithRetry(importFn, { reloadKey = CHUNK_RELOAD_KEY } = {}) {
  return lazy(async () => {
    try {
      const module = await importFn();
      sessionStorage.removeItem(reloadKey);
      return module;
    } catch (error) {
      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError && !sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
        return new Promise(() => {});
      }

      throw error;
    }
  });
}
