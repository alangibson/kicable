/**
 * ProjectListScreen — main landing screen for G1 (FR-PM-01 – FR-PM-04)
 *
 * Features:
 *  - List projects ordered by last updated
 *  - Create, rename, duplicate, delete projects
 *  - Prominent "Export project" button per project
 *  - Import project from .chd file
 *  - Storage quota warning banner (via StorageBanner)
 */

import { useRef, useState, type FC, type ChangeEvent } from 'react';
import type { Project, ProjectId, ProjectMeta } from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';
import { useProjects } from './useProjects.js';
import StorageBanner from './StorageBanner.js';

interface Props {
  storage: StorageAdapter;
  onOpenProject: (project: Project) => void;
  onOpenLibrary: () => void;
}

const ProjectListScreen: FC<Props> = ({ storage, onOpenProject, onOpenLibrary }) => {
  const {
    projects,
    loading,
    error,
    createProject,
    renameProject,
    duplicateProject,
    deleteProject,
    exportProject,
    importProject,
  } = useProjects(storage);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<ProjectId | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setActionError(null);
    try {
      await createProject(name);
      setNewName('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  function startRename(project: ProjectMeta) {
    setRenamingId(project.id as ProjectId);
    setRenameValue(project.name);
    setActionError(null);
  }

  async function confirmRename(id: ProjectId) {
    const name = renameValue.trim();
    if (!name) return;
    setActionError(null);
    try {
      await renameProject(id, name);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to rename project');
    } finally {
      setRenamingId(null);
    }
  }

  async function handleDuplicate(id: ProjectId) {
    setActionError(null);
    try {
      await duplicateProject(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to duplicate project');
    }
  }

  async function handleDelete(project: ProjectMeta) {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await deleteProject(project.id as ProjectId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  }

  async function handleExport(id: ProjectId) {
    setActionError(null);
    try {
      await exportProject(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to export project');
    }
  }

  async function handleOpen(id: ProjectId) {
    setActionError(null);
    try {
      const project = await storage.getProject(id);
      if (!project) throw new Error('Project not found');
      onOpenProject(project);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to open project');
    }
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionError(null);
    try {
      await importProject(file);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to import project');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Cable Harness Designer</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>Projects</p>
        </div>
        <button
          type="button"
          onClick={onOpenLibrary}
          style={{
            padding: '0.5rem 1rem',
            background: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          Component Library
        </button>
      </header>

      {/* Create new project */}
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name…"
          required
          style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          style={{
            padding: '0.5rem 1rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: creating ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? 'Creating…' : 'New Project'}
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          style={{
            padding: '0.5rem 1rem',
            background: '#fff',
            color: '#374151',
            border: '1px solid #ccc',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Import .chd
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".chd"
          onChange={handleImport}
          style={{ display: 'none' }}
          aria-label="Import .chd project file"
        />
      </form>

      {actionError && (
        <div
          role="alert"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 4,
          }}
        >
          {actionError}
        </div>
      )}

      {loading && <p>Loading projects…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && projects.length === 0 && (
        <p style={{ color: '#666' }}>No projects yet. Create one above or import a .chd file.</p>
      )}

      {projects.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {projects.map((project) => (
            <li
              key={project.id}
              style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '1rem', background: '#fff' }}
            >
              {renamingId === project.id ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void confirmRename(project.id as ProjectId);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    style={{ flex: 1, padding: '0.375rem 0.5rem', border: '1px solid #6366f1', borderRadius: 4 }}
                  />
                  <button
                    onClick={() => void confirmRename(project.id as ProjectId)}
                    style={{ padding: '0.375rem 0.75rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    style={{ padding: '0.375rem 0.75rem', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: '1rem' }}>{project.name}</strong>
                    {project.description && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                        {project.description}
                      </p>
                    )}
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                      {project.author && <span>{project.author} · </span>}
                      Updated {formatDate(project.updatedAt)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                    <button
                      onClick={() => void handleOpen(project.id as ProjectId)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                      }}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => void handleExport(project.id as ProjectId)}
                      title="Export project as .chd file"
                      style={{
                        padding: '0.375rem 0.75rem',
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                      }}
                    >
                      Export .chd
                    </button>
                    <button
                      onClick={() => startRename(project)}
                      style={{ padding: '0.375rem 0.625rem', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => void handleDuplicate(project.id as ProjectId)}
                      style={{ padding: '0.375rem 0.625rem', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => void handleDelete(project)}
                      style={{ padding: '0.375rem 0.625rem', background: '#fff', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <StorageBanner />
    </div>
  );
};

export default ProjectListScreen;
