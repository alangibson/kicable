/**
 * ComponentLibraryScreen — manage the component library (G1)
 *
 * Layout:
 *  ┌──────────────────────────────────────────────────────┐
 *  │  Top bar: back · title · export JSON · import JSON   │
 *  ├────────────────┬─────────────────────────────────────┤
 *  │  Component     │  Detail panel                       │
 *  │  list / new    │   ComponentEditor / ImageGallery /   │
 *  │                │   StepFilePanel                     │
 *  └────────────────┴─────────────────────────────────────┘
 *
 * FR-CL-01  Seed built-ins on first use
 * FR-CL-02  Create custom connector
 * FR-CL-03  Per-pin function labels (inside ComponentEditor)
 * FR-CL-04  Export / import JSON
 * FR-CL-06  Version shown in list
 * FR-CL-07–FR-CL-13  Image gallery (inside ImageGallery)
 * FR-CL-15–FR-CL-19  STEP file panel
 */

import { useState, useRef, useEffect, type FC, type ChangeEvent } from 'react';
import type { Component } from '@kicable/shared';
import type { ComponentId } from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';
import { useLibrary } from './useLibrary.js';
import ComponentEditor from './ComponentEditor.js';
import ImageGallery from './ImageGallery.js';
import StepFilePanel from './StepFilePanel.js';
import { downloadLibraryJson, importLibraryFile } from './libraryIo.js';

type DetailTab = 'edit' | 'images' | 'step';

interface Props {
  storage: StorageAdapter;
  onClose: () => void;
}

export const ComponentLibraryScreen: FC<Props> = ({ storage, onClose }) => {
  const library = useLibrary(storage);
  const { components, loading, error, saveComponent, deleteComponent } = library;

  const [selectedId, setSelectedId] = useState<ComponentId | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [query, setQuery] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('edit');
  const [actionError, setActionError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Seed built-ins on first load (FR-CL-01)
  useEffect(() => {
    if (!loading && components.length === 0) {
      void library.seedBuiltins();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const selected = components.find((c) => c.id === selectedId) ?? null;

  const filtered = components.filter((c) => {
    const q = query.toLowerCase();
    return (
      !q ||
      c.partNumber.toLowerCase().includes(q) ||
      c.manufacturer.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  });

  async function handleSave(draft: Parameters<typeof saveComponent>[0]) {
    setActionError(null);
    try {
      const comp = await saveComponent(draft);
      setSelectedId(comp.id as ComponentId);
      setCreatingNew(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function handleDelete(comp: Component) {
    if (!confirm(`Delete "${comp.partNumber}"? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await deleteComponent(comp.id as ComponentId);
      if (selectedId === comp.id) setSelectedId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleExportJson() {
    setActionError(null);
    try {
      await downloadLibraryJson(components, storage);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Export failed');
    }
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setActionError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const result = await importLibraryFile(file, storage, components);
      // Reload through the hook by triggering a re-list via a dummy save — hook will refresh
      await library.seedBuiltins(); // no-op if already has items; just re-loads
      const parts: string[] = [`Imported ${result.imported} component(s).`];
      if (result.skipped) parts.push(`${result.skipped} skipped (already exist).`);
      if (result.errors.length) parts.push(`${result.errors.length} error(s).`);
      setImportResult(parts.join(' '));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const tabBtn = (tab: DetailTab, label: string) => (
    <button
      type="button"
      onClick={() => setDetailTab(tab)}
      style={{
        padding: '4px 12px',
        background: detailTab === tab ? '#2563eb' : '#fff',
        color: detailTab === tab ? '#fff' : '#374151',
        border: `1px solid ${detailTab === tab ? '#2563eb' : '#cbd5e1'}`,
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: detailTab === tab ? 600 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'sans-serif',
        background: '#f8fafc',
        overflow: 'hidden',
      }}
    >
      {/* ── Top bar ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          background: '#1e293b',
          color: '#f1f5f9',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Back"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Component Library</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => void handleExportJson()}
          style={{
            padding: '4px 12px',
            background: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Export JSON
        </button>
        <button
          type="button"
          disabled={importing}
          onClick={() => importInputRef.current?.click()}
          style={{
            padding: '4px 12px',
            background: '#fff',
            color: '#374151',
            border: 'none',
            borderRadius: 4,
            cursor: importing ? 'not-allowed' : 'pointer',
            fontSize: 12,
          }}
        >
          {importing ? 'Importing…' : 'Import JSON'}
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void handleImport(e)}
          style={{ display: 'none' }}
          aria-label="Import library JSON"
        />
      </header>

      {(actionError || importResult) && (
        <div
          role={actionError ? 'alert' : 'status'}
          style={{
            padding: '6px 16px',
            background: actionError ? '#fee2e2' : '#dcfce7',
            color: actionError ? '#991b1b' : '#166534',
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {actionError ?? importResult}
        </div>
      )}

      {/* ── Body: list + detail ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Component list */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            borderRight: '1px solid #e2e8f0',
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter components…"
              aria-label="Filter components"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '4px 8px',
                fontSize: 12,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                marginBottom: 6,
              }}
            />
            <button
              type="button"
              onClick={() => { setCreatingNew(true); setSelectedId(null); setDetailTab('edit'); }}
              style={{
                width: '100%',
                padding: '5px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              + New Component
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <p style={{ padding: 10, fontSize: 12, color: '#94a3b8' }}>Loading…</p>}
            {error && <p style={{ padding: 10, fontSize: 12, color: '#dc2626' }}>{error}</p>}
            {!loading && filtered.length === 0 && (
              <p style={{ padding: 10, fontSize: 12, color: '#94a3b8' }}>
                {components.length === 0 ? 'No components.' : 'No matches.'}
              </p>
            )}
            {filtered.map((comp) => (
              <div
                key={comp.id}
                onClick={() => { setSelectedId(comp.id as ComponentId); setCreatingNew(false); setDetailTab('edit'); }}
                style={{
                  padding: '8px 10px',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  background: selectedId === comp.id ? '#eff6ff' : 'transparent',
                  borderLeft: `3px solid ${selectedId === comp.id ? '#2563eb' : 'transparent'}`,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>{comp.partNumber}</div>
                {comp.manufacturer && (
                  <div style={{ fontSize: 11, color: '#64748b' }}>{comp.manufacturer}</div>
                )}
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  {comp.pinCount} pins · v{comp.version}
                  {comp.images.length > 0 && ` · ${comp.images.length} img`}
                  {comp.stepFile && ' · STEP'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {creatingNew && (
            <>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, color: '#1e293b' }}>New Component</h2>
              <ComponentEditor
                onSave={handleSave}
                onCancel={() => setCreatingNew(false)}
              />
            </>
          )}

          {!creatingNew && selected && (
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
                {tabBtn('edit', 'Details')}
                {tabBtn('images', `Images (${selected.images.length})`)}
                {tabBtn('step', selected.stepFile ? 'STEP ✓' : 'STEP')}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => void handleDelete(selected)}
                  style={{
                    padding: '4px 12px',
                    background: '#fff',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Delete
                </button>
              </div>

              {detailTab === 'edit' && (
                <ComponentEditor
                  initial={selected}
                  onSave={handleSave}
                  onCancel={() => setSelectedId(null)}
                />
              )}

              {detailTab === 'images' && (
                <ImageGallery component={selected} library={library} />
              )}

              {detailTab === 'step' && (
                <StepFilePanel component={selected} library={library} />
              )}
            </>
          )}

          {!creatingNew && !selected && !loading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#94a3b8',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 32 }}>🔌</span>
              <p style={{ margin: 0, fontSize: 14 }}>Select a component or create a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComponentLibraryScreen;
