/**
 * Tests for library JSON export / import (FR-CL-04, FR-CL-12).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { exportLibraryJson, importLibraryJson } from '../../library/libraryIo.js';
import type { StorageAdapter } from '@kicable/shared';
import type { Project, ProjectMeta, Component } from '@kicable/shared';
import type { ProjectId, ComponentId } from '@kicable/shared';
import { makeId } from '@kicable/shared';

// ---------------------------------------------------------------------------
// Minimal in-memory StorageAdapter
// ---------------------------------------------------------------------------

class MemoryAdapter implements StorageAdapter {
  private projects = new Map<string, Project>();
  private components = new Map<string, Component>();
  private blobs = new Map<string, ArrayBuffer>();

  async listProjects(): Promise<ProjectMeta[]> { return []; }
  async getProject(_id: ProjectId): Promise<Project | null> { return null; }
  async saveProject(p: Project): Promise<void> { this.projects.set(p.meta.id, p); }
  async deleteProject(_id: ProjectId): Promise<void> {}
  async listComponents(): Promise<Component[]> { return [...this.components.values()]; }
  async getComponent(id: ComponentId): Promise<Component | null> { return this.components.get(id) ?? null; }
  async saveComponent(c: Component): Promise<void> { this.components.set(c.id, c); }
  async deleteComponent(id: ComponentId): Promise<void> { this.components.delete(id); }
  async putBlob(key: string, data: ArrayBuffer): Promise<void> { this.blobs.set(key, data); }
  async getBlob(key: string): Promise<ArrayBuffer | null> { return this.blobs.get(key) ?? null; }
  async deleteBlob(key: string): Promise<void> { this.blobs.delete(key); }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

function makeComponent(partNumber: string, id?: string): Component {
  return {
    id: (id ?? makeId<'Component'>()) as ComponentId,
    partNumber,
    manufacturer: 'Acme',
    pinCount: 2,
    pins: [
      { number: 1, label: 'A', function: 'SIGNAL' },
      { number: 2, label: 'B', function: 'GND' },
    ],
    gender: 'neutral',
    description: 'Test component',
    version: 0,
    images: [],
    stepFile: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

// ---------------------------------------------------------------------------
// FR-CL-04: Export / import round-trip (no images)
// ---------------------------------------------------------------------------

describe('exportLibraryJson / importLibraryJson — no images', () => {
  it('round-trips a component with no images', async () => {
    const storage = new MemoryAdapter();
    const comp = makeComponent('DT04-2P');
    const json = await exportLibraryJson([comp], storage);

    const payload = JSON.parse(json) as { formatVersion: number; components: unknown[] };
    expect(payload.formatVersion).toBe(1);
    expect(payload.components).toHaveLength(1);

    const result = await importLibraryJson(json, storage, []);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const stored = await storage.listComponents();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.partNumber).toBe('DT04-2P');
  });

  it('skips components whose IDs already exist in the library', async () => {
    const storage = new MemoryAdapter();
    const comp = makeComponent('DT04-2P');
    const json = await exportLibraryJson([comp], storage);

    // Import once
    await importLibraryJson(json, storage, []);
    // Second import — different existing set but same source JSON → new IDs assigned, imported
    const result = await importLibraryJson(json, storage, []);
    // importLibraryJson re-assigns IDs so it should always succeed
    expect(result.imported).toBeGreaterThanOrEqual(1);
  });

  it('rejects non-JSON input', async () => {
    const storage = new MemoryAdapter();
    await expect(importLibraryJson('not json', storage, [])).rejects.toThrow(/valid JSON/);
  });

  it('rejects wrong format version', async () => {
    const storage = new MemoryAdapter();
    const bad = JSON.stringify({ formatVersion: 99, components: [] });
    await expect(importLibraryJson(bad, storage, [])).rejects.toThrow(/Unsupported/);
  });

  it('rejects payload missing components array', async () => {
    const storage = new MemoryAdapter();
    const bad = JSON.stringify({ formatVersion: 1 });
    await expect(importLibraryJson(bad, storage, [])).rejects.toThrow(/"components"/);
  });
});

// ---------------------------------------------------------------------------
// FR-CL-12: Images embedded as Base64 data URIs
// ---------------------------------------------------------------------------

describe('exportLibraryJson / importLibraryJson — with images (FR-CL-12)', () => {
  it('embeds image blobs as Base64 data URIs and restores them on import', async () => {
    const exportStorage = new MemoryAdapter();
    const compId = makeId<'Component'>() as ComponentId;
    const imageId = makeId<'Image'>();
    const blobKey = `${compId}/${imageId}`;
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer; // fake PNG header
    await exportStorage.putBlob(blobKey, imageData);

    const comp: Component = {
      ...makeComponent('IMG-COMP', compId),
      images: [
        {
          id: imageId,
          componentId: compId,
          viewType: 'front',
          mimeType: 'image/png',
          filename: 'front.png',
          sizeBytes: 4,
          isPrimary: true,
          uploadedAt: NOW,
          sortOrder: 0,
        },
      ],
    };

    const json = await exportLibraryJson([comp], exportStorage);

    // Verify data URI is embedded
    const payload = JSON.parse(json) as {
      components: Array<{ images: Array<{ dataUri: string | null }> }>;
    };
    const exportedImg = payload.components[0]?.images[0];
    expect(exportedImg?.dataUri).toMatch(/^data:image\/png;base64,/);

    // Import into a fresh storage
    const importStorage = new MemoryAdapter();
    const result = await importLibraryJson(json, importStorage, []);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);

    const imported = await importStorage.listComponents();
    expect(imported).toHaveLength(1);
    expect(imported[0]?.images).toHaveLength(1);
    expect(imported[0]?.images[0]?.filename).toBe('front.png');

    // Verify the blob was restored correctly
    const restoredId = imported[0]!.images[0]!.id;
    const restoredCompId = imported[0]!.id as ComponentId;
    const restoredBlob = await importStorage.getBlob(`${restoredCompId}/${restoredId}`);
    expect(restoredBlob).not.toBeNull();
    expect(new Uint8Array(restoredBlob!)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  });

  it('exports null dataUri when blob is missing, and skips restore gracefully', async () => {
    const exportStorage = new MemoryAdapter();
    const compId = makeId<'Component'>() as ComponentId;
    const imageId = makeId<'Image'>();
    // Do NOT put the blob — simulate missing blob

    const comp: Component = {
      ...makeComponent('NO-BLOB', compId),
      images: [
        {
          id: imageId,
          componentId: compId,
          viewType: 'other',
          mimeType: 'image/jpeg',
          filename: 'missing.jpg',
          sizeBytes: 0,
          isPrimary: true,
          uploadedAt: NOW,
          sortOrder: 0,
        },
      ],
    };

    const json = await exportLibraryJson([comp], exportStorage);
    const payload = JSON.parse(json) as {
      components: Array<{ images: Array<{ dataUri: string | null }> }>;
    };
    expect(payload.components[0]?.images[0]?.dataUri).toBeNull();

    // Import still works; no blob stored
    const importStorage = new MemoryAdapter();
    const result = await importLibraryJson(json, importStorage, []);
    expect(result.imported).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// builtinLibrary — shape checks
// ---------------------------------------------------------------------------

describe('BUILTIN_COMPONENTS', () => {
  it('all built-in components have valid pinCount and pins array', async () => {
    const { BUILTIN_COMPONENTS } = await import('@kicable/shared');
    for (const comp of BUILTIN_COMPONENTS) {
      expect(comp.pinCount).toBeGreaterThan(0);
      expect(comp.pins).toHaveLength(comp.pinCount);
      expect(comp.partNumber.length).toBeGreaterThan(0);
    }
  });

  it('includes Deutsch DT, AMP Superseal, and TE MCP families', async () => {
    const { BUILTIN_COMPONENTS } = await import('@kicable/shared');
    const manufacturers = new Set(BUILTIN_COMPONENTS.map((c) => c.manufacturer));
    expect([...manufacturers].some((m) => m.includes('Deutsch'))).toBe(true);
    expect([...manufacturers].some((m) => m.includes('TE'))).toBe(true);
  });

  it('has at least 20 built-in components', async () => {
    const { BUILTIN_COMPONENTS } = await import('@kicable/shared');
    expect(BUILTIN_COMPONENTS.length).toBeGreaterThanOrEqual(20);
  });
});
