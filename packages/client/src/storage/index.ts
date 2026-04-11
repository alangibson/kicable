import type { StorageAdapter } from '@kicable/shared';
import { IndexedDBAdapter } from './IndexedDBAdapter.js';

/**
 * Resolve the active StorageAdapter based on build-time env vars.
 *
 * G1: VITE_BACKEND_URL is absent → IndexedDBAdapter
 * G3+: VITE_BACKEND_URL is set → ApiAdapter (not yet implemented)
 */
function createAdapter(): StorageAdapter {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (backendUrl) {
    // G3+ ApiAdapter will be wired here when the backend is added.
    throw new Error(`ApiAdapter not yet implemented. VITE_BACKEND_URL=${backendUrl}`);
  }
  return new IndexedDBAdapter();
}

/** Singleton adapter instance for the entire application */
export const storage: StorageAdapter = createAdapter();
