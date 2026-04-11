import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBAdapter } from '../../storage/IndexedDBAdapter.js';
import type { Project, Component } from '@kicable/shared';
import { makeId } from '@kicable/shared';
import type { ProjectId, ComponentId } from '@kicable/shared';

// Replace indexedDB with a fresh instance before each test to ensure isolation
beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<Project['meta']> = {}): Project {
  const now = new Date().toISOString();
  return {
    meta: {
      id: makeId<'Project'>(),
      name: 'Test Harness',
      description: '',
      author: '',
      schematicVersion: 0,
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

function makeComponent(overrides: Partial<Component> = {}): Component {
  const now = new Date().toISOString();
  return {
    id: makeId<'Component'>(),
    partNumber: 'DT04-2P',
    manufacturer: 'Deutsch',
    pinCount: 2,
    pins: [
      { number: 1, label: 'A', function: 'SIGNAL' },
      { number: 2, label: 'B', function: 'GND' },
    ],
    gender: 'neutral',
    description: '',
    version: 0,
    images: [],
    stepFile: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

describe('IndexedDBAdapter — projects', () => {
  it('listProjects returns empty array initially', async () => {
    const adapter = new IndexedDBAdapter();
    expect(await adapter.listProjects()).toEqual([]);
  });

  it('saveProject and getProject round-trips a project', async () => {
    const adapter = new IndexedDBAdapter();
    const project = makeProject({ name: 'Harness A' });
    await adapter.saveProject(project);
    const retrieved = await adapter.getProject(project.meta.id);
    expect(retrieved).toEqual(project);
  });

  it('getProject returns null for unknown id', async () => {
    const adapter = new IndexedDBAdapter();
    const result = await adapter.getProject('unknown-id' as ProjectId);
    expect(result).toBeNull();
  });

  it('listProjects returns metadata sorted by updatedAt descending', async () => {
    const adapter = new IndexedDBAdapter();
    const now = Date.now();
    const p1 = makeProject({ name: 'A', updatedAt: new Date(now - 2000).toISOString() });
    const p2 = makeProject({ name: 'B', updatedAt: new Date(now - 1000).toISOString() });
    const p3 = makeProject({ name: 'C', updatedAt: new Date(now).toISOString() });
    await adapter.saveProject(p1);
    await adapter.saveProject(p2);
    await adapter.saveProject(p3);
    const metas = await adapter.listProjects();
    expect(metas.map((m) => m.name)).toEqual(['C', 'B', 'A']);
  });

  it('saveProject replaces an existing project', async () => {
    const adapter = new IndexedDBAdapter();
    const project = makeProject({ name: 'Original' });
    await adapter.saveProject(project);
    const updated: Project = { ...project, meta: { ...project.meta, name: 'Updated' } };
    await adapter.saveProject(updated);
    const retrieved = await adapter.getProject(project.meta.id);
    expect(retrieved?.meta.name).toBe('Updated');
    const metas = await adapter.listProjects();
    expect(metas).toHaveLength(1);
  });

  it('deleteProject removes the project', async () => {
    const adapter = new IndexedDBAdapter();
    const project = makeProject();
    await adapter.saveProject(project);
    await adapter.deleteProject(project.meta.id);
    expect(await adapter.getProject(project.meta.id)).toBeNull();
    expect(await adapter.listProjects()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Component CRUD
// ---------------------------------------------------------------------------

describe('IndexedDBAdapter — components', () => {
  it('listComponents returns empty array initially', async () => {
    const adapter = new IndexedDBAdapter();
    expect(await adapter.listComponents()).toEqual([]);
  });

  it('saveComponent and getComponent round-trips a component', async () => {
    const adapter = new IndexedDBAdapter();
    const component = makeComponent();
    await adapter.saveComponent(component);
    const retrieved = await adapter.getComponent(component.id);
    expect(retrieved).toEqual(component);
  });

  it('getComponent returns null for unknown id', async () => {
    const adapter = new IndexedDBAdapter();
    const result = await adapter.getComponent('no-such-id' as ComponentId);
    expect(result).toBeNull();
  });

  it('saveComponent replaces an existing component', async () => {
    const adapter = new IndexedDBAdapter();
    const component = makeComponent({ partNumber: 'DT04-2P' });
    await adapter.saveComponent(component);
    const updated: Component = { ...component, partNumber: 'DT06-4S' };
    await adapter.saveComponent(updated);
    const retrieved = await adapter.getComponent(component.id);
    expect(retrieved?.partNumber).toBe('DT06-4S');
    expect(await adapter.listComponents()).toHaveLength(1);
  });

  it('deleteComponent removes the component', async () => {
    const adapter = new IndexedDBAdapter();
    const component = makeComponent();
    await adapter.saveComponent(component);
    await adapter.deleteComponent(component.id);
    expect(await adapter.getComponent(component.id)).toBeNull();
    expect(await adapter.listComponents()).toHaveLength(0);
  });

  it('listComponents returns all saved components', async () => {
    const adapter = new IndexedDBAdapter();
    const c1 = makeComponent({ partNumber: 'C1' });
    const c2 = makeComponent({ partNumber: 'C2' });
    await adapter.saveComponent(c1);
    await adapter.saveComponent(c2);
    const all = await adapter.listComponents();
    expect(all).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Blob store
// ---------------------------------------------------------------------------

describe('IndexedDBAdapter — blobs', () => {
  it('putBlob and getBlob round-trips an ArrayBuffer', async () => {
    const adapter = new IndexedDBAdapter();
    const data = new Uint8Array([1, 2, 3, 4]).buffer;
    await adapter.putBlob('comp-1/img-1', data);
    const retrieved = await adapter.getBlob('comp-1/img-1');
    expect(retrieved).not.toBeNull();
    expect(new Uint8Array(retrieved!)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('getBlob returns null for unknown key', async () => {
    const adapter = new IndexedDBAdapter();
    expect(await adapter.getBlob('nonexistent/key')).toBeNull();
  });

  it('deleteBlob removes the blob', async () => {
    const adapter = new IndexedDBAdapter();
    const data = new Uint8Array([9, 8]).buffer;
    await adapter.putBlob('comp/step', data);
    await adapter.deleteBlob('comp/step');
    expect(await adapter.getBlob('comp/step')).toBeNull();
  });

  it('deleteBlob is a no-op for missing keys', async () => {
    const adapter = new IndexedDBAdapter();
    await expect(adapter.deleteBlob('missing/key')).resolves.toBeUndefined();
  });

  it('putBlob replaces existing data at the same key', async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.putBlob('comp/img', new Uint8Array([1]).buffer);
    await adapter.putBlob('comp/img', new Uint8Array([2, 3]).buffer);
    const retrieved = await adapter.getBlob('comp/img');
    expect(new Uint8Array(retrieved!)).toEqual(new Uint8Array([2, 3]));
  });
});

// ---------------------------------------------------------------------------
// STEP file size guards
// ---------------------------------------------------------------------------

describe('IndexedDBAdapter — STEP file size guards', () => {
  it('throws when STEP file exceeds MAX_STEP_FILE_SIZE_BYTES (200 MB)', async () => {
    const adapter = new IndexedDBAdapter();
    // Simulate a 201 MB buffer using a SharedArrayBuffer-like trick: just use a large byteLength
    // We create a real buffer descriptor without allocating 201 MB by using DataView tricks.
    // Instead, patch the byteLength via a proxy.
    const fakeBuffer = new Proxy(new ArrayBuffer(1), {
      get(target, prop) {
        if (prop === 'byteLength') return 201 * 1024 * 1024;
        return Reflect.get(target, prop);
      },
    }) as ArrayBuffer;

    await expect(adapter.putBlob('comp/step', fakeBuffer)).rejects.toThrow(
      /exceeds the maximum allowed size/,
    );
  });

  it('emits console.warn when STEP file is between 50 MB and 200 MB', async () => {
    const adapter = new IndexedDBAdapter();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 51 MB — above warn threshold, below hard limit.
    // Use a Proxy so the byteLength check passes without allocating 51 MB.
    // fake-indexeddb will fail to clone the proxy, but the warn runs first.
    const fakeBuffer = new Proxy(new ArrayBuffer(1), {
      get(target, prop) {
        if (prop === 'byteLength') return 51 * 1024 * 1024;
        return Reflect.get(target, prop as string);
      },
    }) as ArrayBuffer;

    // warn fires before the DB put; DataCloneError from fake-indexeddb is expected
    await adapter.putBlob('comp/step', fakeBuffer).catch(() => {});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds'));
    warnSpy.mockRestore();
  });

  it('does NOT warn for non-step blob keys regardless of size', async () => {
    const adapter = new IndexedDBAdapter();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Size-check is only triggered for /step keys; image keys skip it entirely
    const fakeBuffer = new Proxy(new ArrayBuffer(1), {
      get(target, prop) {
        if (prop === 'byteLength') return 51 * 1024 * 1024;
        return Reflect.get(target, prop as string);
      },
    }) as ArrayBuffer;

    await adapter.putBlob('comp/image-1', fakeBuffer).catch(() => {});
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Quota warning
// ---------------------------------------------------------------------------

describe('IndexedDBAdapter — quota warning', () => {
  it('dispatches kicable:storage-near-quota event when storage is near quota', async () => {
    // Patch navigator.storage.estimate to simulate near-quota
    const origStorage = navigator.storage;
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 90, quota: 100 }) },
      configurable: true,
    });

    const adapter = new IndexedDBAdapter();
    const eventSpy = vi.fn();
    window.addEventListener('kicable:storage-near-quota', eventSpy);

    await adapter.saveProject(makeProject());

    expect(eventSpy).toHaveBeenCalledOnce();

    window.removeEventListener('kicable:storage-near-quota', eventSpy);
    Object.defineProperty(navigator, 'storage', { value: origStorage, configurable: true });
  });

  it('does NOT dispatch event when storage is below quota threshold', async () => {
    const origStorage = navigator.storage;
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 10, quota: 100 }) },
      configurable: true,
    });

    const adapter = new IndexedDBAdapter();
    const eventSpy = vi.fn();
    window.addEventListener('kicable:storage-near-quota', eventSpy);

    await adapter.saveProject(makeProject());

    expect(eventSpy).not.toHaveBeenCalled();

    window.removeEventListener('kicable:storage-near-quota', eventSpy);
    Object.defineProperty(navigator, 'storage', { value: origStorage, configurable: true });
  });
});
