/**
 * autosave.worker.ts — background worker for non-blocking project saves (NFR-R-01)
 *
 * Receives: { project: Project }
 * Responds: { ok: true } | { ok: false; error: string }
 *
 * Opens the same IndexedDB ('kicable' v1) as IndexedDBAdapter and writes
 * directly, keeping the main UI thread free during saves.
 */

import { openDB } from 'idb';
import type { Project } from '@kicable/shared';

const DB_NAME = 'kicable';
const DB_VERSION = 1;

async function saveProject(project: Project): Promise<void> {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('projects')) {
        const store = d.createObjectStore('projects', { keyPath: 'meta.id' });
        store.createIndex('updatedAt', 'meta.updatedAt');
      }
      if (!d.objectStoreNames.contains('components')) {
        d.createObjectStore('components', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('blobs')) {
        d.createObjectStore('blobs', { keyPath: 'key' });
      }
    },
  });
  await db.put('projects', project);
}

self.addEventListener('message', (e: MessageEvent<{ project: Project }>) => {
  const { project } = e.data;
  saveProject(project)
    .then(() => {
      self.postMessage({ ok: true });
    })
    .catch((err: unknown) => {
      self.postMessage({
        ok: false,
        error: err instanceof Error ? err.message : 'Auto-save failed',
      });
    });
});
