/**
 * Library JSON export / import — FR-CL-04, FR-CL-12
 *
 * Export:  serialize all components; embed image blobs as Base64 data URIs.
 *          STEP binaries are NOT embedded (can be 200 MB) — stepFile metadata
 *          is preserved but the binary is excluded.
 *
 * Import:  parse the JSON, extract Base64 images back to ArrayBuffers,
 *          and store them via the StorageAdapter.
 */

import { ComponentSchema } from '@kicable/shared';
import type { Component, ComponentImage } from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';
import type { ComponentId, ImageId } from '@kicable/shared';
import { imageBlobKey, makeId, nowIso } from '@kicable/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Serialised component with Base64 image data URIs instead of blob keys */
export interface ExportedComponent extends Omit<Component, 'images'> {
  images: ExportedImage[];
}

export interface ExportedImage extends ComponentImage {
  /** Base64 data URI (e.g. "data:image/png;base64,…") — FR-CL-12 */
  dataUri: string | null;
}

export interface LibraryExport {
  /** Semver-style format marker so future importers can detect breaking changes */
  formatVersion: 1;
  exportedAt: string;
  components: ExportedComponent[];
}

// ---------------------------------------------------------------------------
// Export (FR-CL-04 + FR-CL-12)
// ---------------------------------------------------------------------------

/**
 * Serialise the library to a JSON string suitable for download.
 * Image blobs are embedded as Base64 data URIs.
 */
export async function exportLibraryJson(
  components: Component[],
  storage: StorageAdapter,
): Promise<string> {
  const exported: ExportedComponent[] = await Promise.all(
    components.map(async (comp) => {
      const exportedImages: ExportedImage[] = await Promise.all(
        comp.images.map(async (img) => {
          const buf = await storage.getBlob(
            imageBlobKey(comp.id as ComponentId, img.id as ImageId),
          );
          let dataUri: string | null = null;
          if (buf) {
            const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
            dataUri = `data:${img.mimeType};base64,${b64}`;
          }
          return { ...img, dataUri };
        }),
      );
      return { ...comp, images: exportedImages };
    }),
  );

  const payload: LibraryExport = {
    formatVersion: 1,
    exportedAt: nowIso(),
    components: exported,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Trigger a browser download of the library JSON file.
 */
export async function downloadLibraryJson(
  components: Component[],
  storage: StorageAdapter,
): Promise<void> {
  const json = await exportLibraryJson(components, storage);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kicable-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import (FR-CL-04 + FR-CL-12)
// ---------------------------------------------------------------------------

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Parse a library JSON string and persist components + images via the adapter.
 * Components whose IDs already exist in `existing` are skipped (no overwrite).
 */
export async function importLibraryJson(
  json: string,
  storage: StorageAdapter,
  existing: Component[],
): Promise<ImportResult> {
  const existingIds = new Set(existing.map((c) => c.id));
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }

  const payload = parsed as { formatVersion?: unknown; components?: unknown };
  if (payload.formatVersion !== 1) {
    throw new Error('Unsupported library format version.');
  }
  if (!Array.isArray(payload.components)) {
    throw new Error('Library JSON is missing "components" array.');
  }

  for (const raw of payload.components as unknown[]) {
    // Strip the dataUri fields before passing to ComponentSchema
    const rawComp = raw as ExportedComponent;
    const images: ComponentImage[] = (rawComp.images ?? []).map(
      ({ dataUri: _dataUri, ...img }) => img,
    );
    const compRaw = { ...rawComp, images };

    const parseResult = ComponentSchema.safeParse(compRaw);
    if (!parseResult.success) {
      result.errors.push(
        `Skipping component "${(rawComp as { partNumber?: string }).partNumber ?? '?'}": ${parseResult.error.message}`,
      );
      result.skipped++;
      continue;
    }

    const comp = parseResult.data;

    if (existingIds.has(comp.id)) {
      result.skipped++;
      continue;
    }

    // Re-assign new IDs to avoid UUID collisions when importing same library twice
    const newCompId = makeId<'Component'>() as ComponentId;
    const remappedImages: ComponentImage[] = [];

    for (let i = 0; i < comp.images.length; i++) {
      const img = comp.images[i]!;
      const exportedImg = rawComp.images[i];
      const newImageId = makeId<'Image'>() as ImageId;
      remappedImages.push({ ...img, id: newImageId, componentId: newCompId });

      if (exportedImg?.dataUri) {
        try {
          const buf = dataUriToArrayBuffer(exportedImg.dataUri);
          await storage.putBlob(imageBlobKey(newCompId, newImageId), buf);
        } catch {
          result.errors.push(`Could not restore image "${img.filename}" for "${comp.partNumber}".`);
        }
      }
    }

    const now = nowIso();
    const finalComp: Component = {
      ...comp,
      id: newCompId,
      images: remappedImages,
      createdAt: now,
      updatedAt: now,
    };
    await storage.saveComponent(finalComp);
    result.imported++;
  }

  return result;
}

/**
 * Parse a library JSON File uploaded via <input type="file">.
 */
export function importLibraryFile(
  file: File,
  storage: StorageAdapter,
  existing: Component[],
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      importLibraryJson(reader.result as string, storage, existing)
        .then(resolve)
        .catch(reject);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dataUriToArrayBuffer(dataUri: string): ArrayBuffer {
  const [header, b64] = dataUri.split(',');
  if (!header || !b64) throw new Error('Invalid data URI');
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  return buf.buffer as ArrayBuffer;
}
