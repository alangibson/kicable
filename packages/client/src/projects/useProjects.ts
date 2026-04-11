/**
 * useProjects — React hook for project CRUD, export, and import (FR-PM-01 – FR-PM-03)
 */

import { useState, useEffect, useCallback } from 'react';
import { makeId, nowIso } from '@kicable/shared';
import type { ProjectId, ProjectMeta, Project } from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';
import { exportChd, importChd, downloadBlob } from './chd.js';

export interface UseProjectsResult {
  projects: ProjectMeta[];
  loading: boolean;
  error: string | null;
  createProject: (name: string, description?: string, author?: string) => Promise<ProjectId>;
  renameProject: (id: ProjectId, name: string) => Promise<void>;
  duplicateProject: (id: ProjectId) => Promise<void>;
  deleteProject: (id: ProjectId) => Promise<void>;
  exportProject: (id: ProjectId) => Promise<void>;
  importProject: (file: File) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProjects(storage: StorageAdapter): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await storage.listProjects();
      setProjects(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [storage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createProject = useCallback(
    async (name: string, description = '', author = ''): Promise<ProjectId> => {
      const id = makeId<'Project'>() as ProjectId;
      const now = nowIso();
      const project: Project = {
        meta: { id, name, description, author, schematicVersion: 0, createdAt: now, updatedAt: now },
        scaleMmPerPx: 1,
        preferredUnit: 'mm',
        routingSlackPct: 0,
        components: [],
        schematic: null,
      };
      await storage.saveProject(project);
      await refresh();
      return id;
    },
    [storage, refresh],
  );

  const renameProject = useCallback(
    async (id: ProjectId, name: string): Promise<void> => {
      const project = await storage.getProject(id);
      if (!project) throw new Error(`Project ${id} not found`);
      await storage.saveProject({
        ...project,
        meta: { ...project.meta, name, updatedAt: nowIso() },
      });
      await refresh();
    },
    [storage, refresh],
  );

  const duplicateProject = useCallback(
    async (id: ProjectId): Promise<void> => {
      const source = await storage.getProject(id);
      if (!source) throw new Error(`Project ${id} not found`);

      const newId = makeId<'Project'>() as ProjectId;
      const now = nowIso();
      const duplicate: Project = {
        ...source,
        meta: {
          ...source.meta,
          id: newId,
          name: `${source.meta.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        },
      };
      await storage.saveProject(duplicate);

      // Duplicate blobs for each component
      for (const component of source.components) {
        for (const image of component.images) {
          const key = `${component.id}/${image.id}`;
          const blob = await storage.getBlob(key);
          if (blob) await storage.putBlob(`${component.id}/${image.id}`, blob);
        }
        if (component.stepFile) {
          const blob = await storage.getBlob(`${component.id}/step`);
          if (blob) await storage.putBlob(`${component.id}/step`, blob);
        }
      }

      await refresh();
    },
    [storage, refresh],
  );

  const deleteProject = useCallback(
    async (id: ProjectId): Promise<void> => {
      const project = await storage.getProject(id);
      if (project) {
        for (const component of project.components) {
          for (const image of component.images) {
            await storage.deleteBlob(`${component.id}/${image.id}`);
          }
          if (component.stepFile) {
            await storage.deleteBlob(`${component.id}/step`);
          }
        }
      }
      await storage.deleteProject(id);
      await refresh();
    },
    [storage, refresh],
  );

  const exportProject = useCallback(
    async (id: ProjectId): Promise<void> => {
      const project = await storage.getProject(id);
      if (!project) throw new Error(`Project ${id} not found`);
      const blob = await exportChd(project, storage);
      const safeName = project.meta.name.replace(/[^a-z0-9_\-]/gi, '_');
      downloadBlob(blob, `${safeName}.chd`);
    },
    [storage],
  );

  const importProject = useCallback(
    async (file: File): Promise<void> => {
      const { project, blobs } = await importChd(file);
      const newId = makeId<'Project'>() as ProjectId;
      const now = nowIso();
      const imported: Project = {
        ...project,
        meta: { ...project.meta, id: newId, updatedAt: now },
      };
      await storage.saveProject(imported);
      for (const [key, data] of blobs) {
        await storage.putBlob(key, data);
      }
      await refresh();
    },
    [storage, refresh],
  );

  return {
    projects,
    loading,
    error,
    createProject,
    renameProject,
    duplicateProject,
    deleteProject,
    exportProject,
    importProject,
    refresh,
  };
}
