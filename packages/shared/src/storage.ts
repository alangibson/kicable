import type { Project, ProjectMeta, Component } from './schemas.js';
import type { ProjectId, ComponentId, ImageId } from './types.js';

/**
 * StorageAdapter — the single interface all persistence layers must implement.
 *
 * G1 active adapter: IndexedDBAdapter (packages/client).
 * G3+ adapter: ApiAdapter — can be swapped in with zero changes to app code,
 * because all application code depends only on this interface.
 */
export interface StorageAdapter {
  // -------------------------------------------------------------------------
  // Project CRUD
  // -------------------------------------------------------------------------

  /** Return metadata for all projects, ordered by updatedAt desc */
  listProjects(): Promise<ProjectMeta[]>;

  /** Load a full project by ID. Returns null if not found. */
  getProject(id: ProjectId): Promise<Project | null>;

  /** Persist a project (insert or replace). Updates updatedAt. */
  saveProject(project: Project): Promise<void>;

  /** Permanently delete a project and all its blobs. */
  deleteProject(id: ProjectId): Promise<void>;

  // -------------------------------------------------------------------------
  // Component library CRUD
  // -------------------------------------------------------------------------

  /** Return all components in the user's library */
  listComponents(): Promise<Component[]>;

  /** Load a single component by ID. Returns null if not found. */
  getComponent(id: ComponentId): Promise<Component | null>;

  /** Persist a component (insert or replace). */
  saveComponent(component: Component): Promise<void>;

  /** Delete a component and all its stored blobs. */
  deleteComponent(id: ComponentId): Promise<void>;

  // -------------------------------------------------------------------------
  // Blob store (images + STEP files)
  // -------------------------------------------------------------------------

  /**
   * Store a binary blob.
   * Key format: `<componentId>/<imageId>` for images,
   *             `<componentId>/step` for STEP files.
   */
  putBlob(key: string, data: ArrayBuffer): Promise<void>;

  /** Retrieve a blob. Returns null if the key does not exist. */
  getBlob(key: string): Promise<ArrayBuffer | null>;

  /** Delete a blob by key. No-op if key does not exist. */
  deleteBlob(key: string): Promise<void>;
}

/** Convenience helper — derive the blob key for a component image */
export function imageBlobKey(componentId: ComponentId, imageId: ImageId): string {
  return `${componentId}/${imageId}`;
}

/** Convenience helper — derive the blob key for a component STEP file */
export function stepBlobKey(componentId: ComponentId): string {
  return `${componentId}/step`;
}
