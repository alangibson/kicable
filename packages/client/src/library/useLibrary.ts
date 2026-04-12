/**
 * useLibrary — component library state + CRUD hook.
 *
 * Covers:
 *  FR-CL-02  Custom connector creation
 *  FR-CL-03  Per-pin function labels
 *  FR-CL-06  Version bumping on save
 *  FR-CL-07  Image attachment (size guard, MIME guard)
 *  FR-CL-08  Image view types
 *  FR-CL-09  Primary image designation
 *  FR-CL-10  Image re-ordering / rename / recategorize / delete
 *  FR-CL-11  Image stored as ArrayBuffer in blobs store
 *  FR-CL-13  Blob key = component_id/image_id
 *  FR-CL-15  STEP file attachment (size guard)
 *  FR-CL-16  STEP file max 200 MB; warn at 50 MB
 *  FR-CL-17  STEP file metadata display
 *  FR-CL-18  STEP file download
 */

import { useState, useEffect, useCallback } from 'react';
import type { Component, ComponentImage, ComponentStepFile } from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';
import type { ComponentId, ImageId } from '@kicable/shared';
import {
  makeId,
  nowIso,
  imageBlobKey,
  stepBlobKey,
  MAX_IMAGE_SIZE_BYTES,
  MAX_STEP_FILE_SIZE_BYTES,
  STEP_FILE_WARN_THRESHOLD_BYTES,
  BUILTIN_COMPONENTS,
} from '@kicable/shared';

export interface UseLibraryReturn {
  components: Component[];
  loading: boolean;
  error: string | null;
  /** Persist a new or updated component. Bumps version on update. */
  saveComponent: (draft: Omit<Component, 'id' | 'version' | 'createdAt' | 'updatedAt'> & { id?: string; version?: number; createdAt?: string }) => Promise<Component>;
  deleteComponent: (id: ComponentId) => Promise<void>;
  /** Attach an image file; returns the new ComponentImage record. */
  addImage: (componentId: ComponentId, file: File, viewType: ComponentImage['viewType']) => Promise<ComponentImage>;
  /** Update image metadata (viewType, filename, sortOrder, isPrimary). */
  updateImage: (componentId: ComponentId, imageId: ImageId, patch: Partial<Pick<ComponentImage, 'viewType' | 'filename' | 'sortOrder' | 'isPrimary'>>) => Promise<void>;
  /** Reorder images by providing a new ordered array of image IDs. */
  reorderImages: (componentId: ComponentId, orderedIds: ImageId[]) => Promise<void>;
  deleteImage: (componentId: ComponentId, imageId: ImageId) => Promise<void>;
  /** Load a data-URI for an image (for display). Cached per imageId. */
  getImageDataUrl: (componentId: ComponentId, imageId: ImageId, mimeType: string) => Promise<string | null>;
  /** Attach a STEP file. Returns the new ComponentStepFile record. */
  attachStep: (componentId: ComponentId, file: File) => Promise<{ stepFile: ComponentStepFile; warnLarge: boolean }>;
  removeStep: (componentId: ComponentId) => Promise<void>;
  /** Trigger browser download of the STEP file. */
  downloadStep: (componentId: ComponentId) => Promise<void>;
  /** Seed built-in components if the library is empty. */
  seedBuiltins: () => Promise<void>;
}

export function useLibrary(storage: StorageAdapter): UseLibraryReturn {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const all = await storage.listComponents();
      setComponents(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }, [storage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // -------------------------------------------------------------------------
  // Component CRUD
  // -------------------------------------------------------------------------

  const saveComponent = useCallback(
    async (
      draft: Omit<Component, 'id' | 'version' | 'createdAt' | 'updatedAt'> & {
        id?: string;
        version?: number;
        createdAt?: string;
      },
    ): Promise<Component> => {
      const now = nowIso();
      const existing = draft.id ? components.find((c) => c.id === draft.id) : undefined;
      const component: Component = {
        ...draft,
        id: (draft.id ?? makeId<'Component'>()) as ComponentId,
        version: existing ? existing.version + 1 : 0,
        createdAt: draft.createdAt ?? now,
        updatedAt: now,
        images: draft.images ?? [],
        stepFile: draft.stepFile ?? null,
      };
      await storage.saveComponent(component);
      await reload();
      return component;
    },
    [components, storage, reload],
  );

  const deleteComponent = useCallback(
    async (id: ComponentId) => {
      const comp = components.find((c) => c.id === id);
      if (comp) {
        // Clean up blobs
        for (const img of comp.images) {
          await storage.deleteBlob(imageBlobKey(id, img.id as ImageId));
        }
        if (comp.stepFile) {
          await storage.deleteBlob(stepBlobKey(id));
        }
      }
      await storage.deleteComponent(id);
      await reload();
    },
    [components, storage, reload],
  );

  // -------------------------------------------------------------------------
  // Image management (FR-CL-07 – FR-CL-13)
  // -------------------------------------------------------------------------

  const addImage = useCallback(
    async (
      componentId: ComponentId,
      file: File,
      viewType: ComponentImage['viewType'],
    ): Promise<ComponentImage> => {
      const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedMime.includes(file.type)) {
        throw new Error(`Unsupported image type "${file.type}". Use JPEG, PNG, WebP, or SVG.`);
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error(
          `Image exceeds the 20 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
        );
      }

      const comp = components.find((c) => c.id === componentId);
      if (!comp) throw new Error('Component not found');

      const imageId = makeId<'Image'>() as ImageId;
      const buf = await file.arrayBuffer();
      await storage.putBlob(imageBlobKey(componentId, imageId), buf);

      const isPrimary = comp.images.length === 0;
      const image: ComponentImage = {
        id: imageId,
        componentId,
        viewType,
        mimeType: file.type as ComponentImage['mimeType'],
        filename: file.name,
        sizeBytes: file.size,
        isPrimary,
        uploadedAt: nowIso(),
        sortOrder: comp.images.length,
      };

      const updated: Component = {
        ...comp,
        images: [...comp.images, image],
        version: comp.version + 1,
        updatedAt: nowIso(),
      };
      await storage.saveComponent(updated);
      await reload();
      return image;
    },
    [components, storage, reload],
  );

  const updateImage = useCallback(
    async (
      componentId: ComponentId,
      imageId: ImageId,
      patch: Partial<Pick<ComponentImage, 'viewType' | 'filename' | 'sortOrder' | 'isPrimary'>>,
    ) => {
      const comp = components.find((c) => c.id === componentId);
      if (!comp) throw new Error('Component not found');

      let images = comp.images.map((img) =>
        img.id === imageId ? { ...img, ...patch } : img,
      );

      // Enforce single primary — if we're setting isPrimary, clear others
      if (patch.isPrimary) {
        images = images.map((img) => ({
          ...img,
          isPrimary: img.id === imageId,
        }));
      }

      const updated: Component = { ...comp, images, version: comp.version + 1, updatedAt: nowIso() };
      await storage.saveComponent(updated);
      await reload();
    },
    [components, storage, reload],
  );

  const reorderImages = useCallback(
    async (componentId: ComponentId, orderedIds: ImageId[]) => {
      const comp = components.find((c) => c.id === componentId);
      if (!comp) throw new Error('Component not found');

      const map = new Map(comp.images.map((img) => [img.id, img]));
      const images = orderedIds
        .map((id, idx) => {
          const img = map.get(id);
          if (!img) return null;
          return { ...img, sortOrder: idx };
        })
        .filter((img): img is ComponentImage => img !== null);

      const updated: Component = { ...comp, images, version: comp.version + 1, updatedAt: nowIso() };
      await storage.saveComponent(updated);
      await reload();
    },
    [components, storage, reload],
  );

  const deleteImage = useCallback(
    async (componentId: ComponentId, imageId: ImageId) => {
      const comp = components.find((c) => c.id === componentId);
      if (!comp) throw new Error('Component not found');

      await storage.deleteBlob(imageBlobKey(componentId, imageId));

      let images = comp.images.filter((img) => img.id !== imageId);
      // If we deleted the primary, promote the first remaining image
      if (images.length > 0 && !images.some((img) => img.isPrimary)) {
        images = images.map((img, idx) => ({ ...img, isPrimary: idx === 0 }));
      }

      const updated: Component = { ...comp, images, version: comp.version + 1, updatedAt: nowIso() };
      await storage.saveComponent(updated);
      await reload();
    },
    [components, storage, reload],
  );

  const getImageDataUrl = useCallback(
    async (
      componentId: ComponentId,
      imageId: ImageId,
      mimeType: string,
    ): Promise<string | null> => {
      const buf = await storage.getBlob(imageBlobKey(componentId, imageId));
      if (!buf) return null;
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return `data:${mimeType};base64,${b64}`;
    },
    [storage],
  );

  // -------------------------------------------------------------------------
  // STEP file management (FR-CL-15 – FR-CL-19)
  // -------------------------------------------------------------------------

  const attachStep = useCallback(
    async (
      componentId: ComponentId,
      file: File,
    ): Promise<{ stepFile: ComponentStepFile; warnLarge: boolean }> => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'step' && ext !== 'stp') {
        throw new Error('Only .step or .stp files are allowed.');
      }
      if (file.size > MAX_STEP_FILE_SIZE_BYTES) {
        throw new Error(
          `STEP file exceeds the 200 MB limit (${(file.size / 1024 / 1024).toFixed(0)} MB).`,
        );
      }

      const comp = components.find((c) => c.id === componentId);
      if (!comp) throw new Error('Component not found');

      const buf = await file.arrayBuffer();
      await storage.putBlob(stepBlobKey(componentId), buf);

      const stepFile: ComponentStepFile = {
        componentId,
        filename: file.name,
        sizeBytes: file.size,
        uploadedAt: nowIso(),
      };

      const updated: Component = { ...comp, stepFile, version: comp.version + 1, updatedAt: nowIso() };
      await storage.saveComponent(updated);
      await reload();

      return { stepFile, warnLarge: file.size > STEP_FILE_WARN_THRESHOLD_BYTES };
    },
    [components, storage, reload],
  );

  const removeStep = useCallback(
    async (componentId: ComponentId) => {
      const comp = components.find((c) => c.id === componentId);
      if (!comp) throw new Error('Component not found');

      await storage.deleteBlob(stepBlobKey(componentId));

      const updated: Component = {
        ...comp,
        stepFile: null,
        version: comp.version + 1,
        updatedAt: nowIso(),
      };
      await storage.saveComponent(updated);
      await reload();
    },
    [components, storage, reload],
  );

  const downloadStep = useCallback(
    async (componentId: ComponentId) => {
      const comp = components.find((c) => c.id === componentId);
      if (!comp?.stepFile) throw new Error('No STEP file attached');

      const buf = await storage.getBlob(stepBlobKey(componentId));
      if (!buf) throw new Error('STEP file data not found in storage');

      const blob = new Blob([buf], { type: 'model/step' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = comp.stepFile.filename;
      // Trigger Content-Disposition: attachment via download attribute
      a.click();
      URL.revokeObjectURL(url);
    },
    [components, storage],
  );

  // -------------------------------------------------------------------------
  // Seed built-ins (FR-CL-01)
  // -------------------------------------------------------------------------

  const seedBuiltins = useCallback(async () => {
    const existing = await storage.listComponents();
    if (existing.length > 0) return;
    for (const comp of BUILTIN_COMPONENTS) {
      await storage.saveComponent(comp);
    }
    await reload();
  }, [storage, reload]);

  return {
    components,
    loading,
    error,
    saveComponent,
    deleteComponent,
    addImage,
    updateImage,
    reorderImages,
    deleteImage,
    getImageDataUrl,
    attachStep,
    removeStep,
    downloadStep,
    seedBuiltins,
  };
}
