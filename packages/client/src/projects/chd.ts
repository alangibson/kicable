/**
 * CHD file format — self-contained project archive (.chd)
 *
 * A .chd file is a ZIP archive containing:
 *   project.json  — full Project object (JSON-serialised)
 *   blobs/<key>   — raw binary blobs (images, STEP files)
 *                   key uses the same format as StorageAdapter blob keys,
 *                   with '/' kept as path separators (valid inside ZIP)
 *
 * FR-PM-03 / FR-CL-20
 */

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { ProjectSchema, imageBlobKey, stepBlobKey } from '@kicable/shared';
import type { Project } from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';

const PROJECT_ENTRY = 'project.json';
const BLOB_PREFIX = 'blobs/';

export interface ChdContents {
  project: Project;
  blobs: Map<string, ArrayBuffer>;
}

/** Collect all blob keys referenced by a project's components */
function collectBlobKeys(project: Project): string[] {
  const keys: string[] = [];
  for (const component of project.components) {
    for (const image of component.images) {
      keys.push(imageBlobKey(component.id, image.id));
    }
    if (component.stepFile) {
      keys.push(stepBlobKey(component.id));
    }
  }
  return keys;
}

/**
 * Build raw ZIP bytes for a project archive.
 * Exported for testing; prefer `exportChd` for application use.
 */
export async function exportChdBuffer(project: Project, storage: StorageAdapter): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};

  files[PROJECT_ENTRY] = strToU8(JSON.stringify(project));

  const blobKeys = collectBlobKeys(project);
  await Promise.all(
    blobKeys.map(async (key) => {
      const data = await storage.getBlob(key);
      if (data) {
        files[`${BLOB_PREFIX}${key}`] = new Uint8Array(data);
      }
    }),
  );

  return zipSync(files, { level: 6 });
}

/**
 * Parse raw CHD ZIP bytes and return the project + blobs.
 * Exported for testing; prefer `importChd` for application use.
 */
export function importChdBuffer(data: Uint8Array): ChdContents {
  const entries = unzipSync(data);

  const projectEntry = entries[PROJECT_ENTRY];
  if (!projectEntry) {
    throw new Error('Invalid .chd file: missing project.json');
  }

  const raw = JSON.parse(strFromU8(projectEntry));
  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid .chd file: project.json failed validation — ${parsed.error.message}`);
  }
  const project = parsed.data;

  const blobs = new Map<string, ArrayBuffer>();
  for (const [entryPath, entryData] of Object.entries(entries)) {
    if (entryPath.startsWith(BLOB_PREFIX)) {
      const key = entryPath.slice(BLOB_PREFIX.length);
      blobs.set(key, entryData.buffer as ArrayBuffer);
    }
  }

  return { project, blobs };
}

/**
 * Export a project to a .chd Blob for download.
 */
export async function exportChd(project: Project, storage: StorageAdapter): Promise<Blob> {
  const bytes = await exportChdBuffer(project, storage);
  return new Blob([bytes], { type: 'application/zip' });
}

/**
 * Parse a .chd File and return the project + blobs.
 * Callers are responsible for persisting them via the storage adapter.
 */
export function importChd(file: File): Promise<ChdContents> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        resolve(importChdBuffer(new Uint8Array(reader.result as ArrayBuffer)));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Trigger a browser file download for the given Blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
