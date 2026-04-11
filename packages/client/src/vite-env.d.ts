/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * When set, requests go to this URL instead of IndexedDB (G3+ mode).
   * When absent or empty string, the app is fully browser-only (G1 mode).
   */
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
