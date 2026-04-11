import { openDB, type IDBPDatabase } from 'idb';
import type { StorageAdapter } from '@kicable/shared';
import type { Project, ProjectMeta, Component } from '@kicable/shared';
import type { ProjectId, ComponentId } from '@kicable/shared';
import {
  isStorageNearQuota,
  STEP_FILE_WARN_THRESHOLD_BYTES,
  MAX_STEP_FILE_SIZE_BYTES,
} from '@kicable/shared';

const DB_NAME = 'kicable';
const DB_VERSION = 1;

interface KicableDB {
  projects: {
    key: string;
    value: Project;
    indexes: { updatedAt: string };
  };
  components: {
    key: string;
    value: Component;
  };
  blobs: {
    key: string;
    value: { key: string; data: ArrayBuffer };
  };
}

async function getDb(): Promise<IDBPDatabase<KicableDB>> {
  return openDB<KicableDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const projects = db.createObjectStore('projects', { keyPath: 'meta.id' });
      projects.createIndex('updatedAt', 'meta.updatedAt');
      db.createObjectStore('components', { keyPath: 'id' });
      db.createObjectStore('blobs', { keyPath: 'key' });
    },
  });
}

export class IndexedDBAdapter implements StorageAdapter {
  // -----------------------------------------------------------------------
  // Projects
  // -----------------------------------------------------------------------

  async listProjects(): Promise<ProjectMeta[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('projects', 'updatedAt');
    return all.map((p) => p.meta).reverse();
  }

  async getProject(id: ProjectId): Promise<Project | null> {
    const db = await getDb();
    return (await db.get('projects', id)) ?? null;
  }

  async saveProject(project: Project): Promise<void> {
    const db = await getDb();
    await db.put('projects', project);
    await this.warnIfNearQuota();
  }

  async deleteProject(id: ProjectId): Promise<void> {
    const db = await getDb();
    await db.delete('projects', id);
  }

  // -----------------------------------------------------------------------
  // Components
  // -----------------------------------------------------------------------

  async listComponents(): Promise<Component[]> {
    const db = await getDb();
    return db.getAll('components');
  }

  async getComponent(id: ComponentId): Promise<Component | null> {
    const db = await getDb();
    return (await db.get('components', id)) ?? null;
  }

  async saveComponent(component: Component): Promise<void> {
    const db = await getDb();
    await db.put('components', component);
    await this.warnIfNearQuota();
  }

  async deleteComponent(id: ComponentId): Promise<void> {
    const db = await getDb();
    await db.delete('components', id);
  }

  // -----------------------------------------------------------------------
  // Blob store
  // -----------------------------------------------------------------------

  async putBlob(key: string, data: ArrayBuffer): Promise<void> {
    // Warn if this looks like a STEP file and exceeds the threshold (FR-CL-16)
    if (key.endsWith('/step') && data.byteLength > MAX_STEP_FILE_SIZE_BYTES) {
      throw new Error(
        `STEP file exceeds the maximum allowed size of ${MAX_STEP_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      );
    }
    if (key.endsWith('/step') && data.byteLength > STEP_FILE_WARN_THRESHOLD_BYTES) {
      // Non-blocking warning — callers may also surface this via UI
      console.warn(
        `STEP file (${(data.byteLength / 1024 / 1024).toFixed(1)} MB) exceeds ` +
          `${STEP_FILE_WARN_THRESHOLD_BYTES / 1024 / 1024} MB. IndexedDB quota may be affected.`,
      );
    }
    const db = await getDb();
    await db.put('blobs', { key, data });
    await this.warnIfNearQuota();
  }

  async getBlob(key: string): Promise<ArrayBuffer | null> {
    const db = await getDb();
    const record = await db.get('blobs', key);
    return record?.data ?? null;
  }

  async deleteBlob(key: string): Promise<void> {
    const db = await getDb();
    await db.delete('blobs', key);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private async warnIfNearQuota(): Promise<void> {
    const near = await isStorageNearQuota(80);
    if (near) {
      // Dispatch a custom DOM event so the UI can show a banner (FR-PM-04)
      window.dispatchEvent(new CustomEvent('kicable:storage-near-quota'));
    }
  }
}
