/**
 * Tests for CHD export/import (FR-PM-03).
 *
 * Runs in Node environment so that Uint8Array identity checks inside fflate
 * work correctly (avoids jsdom cross-realm Uint8Array mismatch).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { exportChdBuffer, importChdBuffer } from '../../projects/chd.js';
import type { StorageAdapter } from '@kicable/shared';
import type { Project, ProjectMeta, Component } from '@kicable/shared';
import type { ProjectId, ComponentId } from '@kicable/shared';
import { makeId } from '@kicable/shared';

// ---------------------------------------------------------------------------
// Minimal in-memory StorageAdapter for tests
// ---------------------------------------------------------------------------

class MemoryAdapter implements StorageAdapter {
  private projects = new Map<string, Project>();
  private components = new Map<string, Component>();
  private blobs = new Map<string, ArrayBuffer>();

  async listProjects(): Promise<ProjectMeta[]> {
    return [...this.projects.values()].map((p) => p.meta);
  }
  async getProject(id: ProjectId): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }
  async saveProject(project: Project): Promise<void> {
    this.projects.set(project.meta.id, project);
  }
  async deleteProject(id: ProjectId): Promise<void> {
    this.projects.delete(id);
  }
  async listComponents(): Promise<Component[]> {
    return [...this.components.values()];
  }
  async getComponent(id: ComponentId): Promise<Component | null> {
    return this.components.get(id) ?? null;
  }
  async saveComponent(component: Component): Promise<void> {
    this.components.set(component.id, component);
  }
  async deleteComponent(id: ComponentId): Promise<void> {
    this.components.delete(id);
  }
  async putBlob(key: string, data: ArrayBuffer): Promise<void> {
    this.blobs.set(key, data);
  }
  async getBlob(key: string): Promise<ArrayBuffer | null> {
    return this.blobs.get(key) ?? null;
  }
  async deleteBlob(key: string): Promise<void> {
    this.blobs.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<Project['meta']> = {}): Project {
  const now = new Date().toISOString();
  return {
    meta: {
      id: makeId<'Project'>() as ProjectId,
      name: 'Test Harness',
      description: 'A test project',
      author: 'Tester',
      schematicVersion: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    },
    scaleMmPerPx: 1,
    preferredUnit: 'mm',
    routingSlackPct: 0,
    components: [],
    schematic: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('exportChdBuffer / importChdBuffer — round-trip (no blobs)', () => {
  it('exports and re-imports project metadata intact', async () => {
    const storage = new MemoryAdapter();
    const project = makeProject({ name: 'Harness Alpha' });

    const bytes = await exportChdBuffer(project, storage);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);

    const { project: imported, blobs } = importChdBuffer(bytes);

    expect(imported.meta.name).toBe('Harness Alpha');
    expect(imported.meta.description).toBe('A test project');
    expect(imported.meta.author).toBe('Tester');
    expect(imported.meta.schematicVersion).toBe(1);
    expect(blobs.size).toBe(0);
  });
});

describe('exportChdBuffer / importChdBuffer — round-trip (with blobs)', () => {
  it('bundles and restores image blobs', async () => {
    const storage = new MemoryAdapter();
    const componentId = makeId<'Component'>() as ComponentId;
    const imageId = makeId<'Image'>();
    const blobKey = `${componentId}/${imageId}`;
    await storage.putBlob(blobKey, new Uint8Array([10, 20, 30, 40]).buffer);

    const now = new Date().toISOString();
    const project: Project = {
      ...makeProject(),
      components: [
        {
          id: componentId,
          partNumber: 'DT04-2P',
          manufacturer: 'Deutsch',
          pinCount: 2,
          pins: [],
          gender: 'neutral',
          description: '',
          version: 0,
          images: [
            {
              id: imageId,
              componentId,
              viewType: 'front',
              mimeType: 'image/png',
              filename: 'front.png',
              sizeBytes: 4,
              isPrimary: true,
              uploadedAt: now,
              sortOrder: 0,
            },
          ],
          stepFile: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    const bytes = await exportChdBuffer(project, storage);
    const { project: imported, blobs } = importChdBuffer(bytes);

    expect(imported.components).toHaveLength(1);
    expect(blobs.size).toBe(1);
    expect(blobs.has(blobKey)).toBe(true);
    expect(new Uint8Array(blobs.get(blobKey)!)).toEqual(new Uint8Array([10, 20, 30, 40]));
  });

  it('bundles and restores STEP file blobs', async () => {
    const storage = new MemoryAdapter();
    const componentId = makeId<'Component'>() as ComponentId;
    const stepKey = `${componentId}/step`;
    await storage.putBlob(stepKey, new Uint8Array([0xff, 0xfe, 0x00]).buffer);

    const now = new Date().toISOString();
    const project: Project = {
      ...makeProject(),
      components: [
        {
          id: componentId,
          partNumber: 'COMP-1',
          manufacturer: '',
          pinCount: 1,
          pins: [],
          gender: 'neutral',
          description: '',
          version: 0,
          images: [],
          stepFile: { componentId, filename: 'comp.step', sizeBytes: 3, uploadedAt: now },
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    const bytes = await exportChdBuffer(project, storage);
    const { blobs } = importChdBuffer(bytes);

    expect(blobs.has(stepKey)).toBe(true);
    expect(new Uint8Array(blobs.get(stepKey)!)).toEqual(new Uint8Array([0xff, 0xfe, 0x00]));
  });
});

describe('importChdBuffer — validation', () => {
  it('throws on data that is not a valid ZIP', () => {
    expect(() => importChdBuffer(new Uint8Array([1, 2, 3]))).toThrow();
  });

  it('throws when project.json is missing from the archive', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { zipSync, strToU8 } = require('fflate');
    const zipped: Uint8Array = zipSync({ 'other.json': strToU8('{}') });
    expect(() => importChdBuffer(zipped)).toThrow(/missing project\.json/);
  });

  it('throws when project.json fails schema validation', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { zipSync, strToU8 } = require('fflate');
    const zipped: Uint8Array = zipSync({ 'project.json': strToU8(JSON.stringify({ invalid: true })) });
    expect(() => importChdBuffer(zipped)).toThrow(/failed validation/);
  });
});
