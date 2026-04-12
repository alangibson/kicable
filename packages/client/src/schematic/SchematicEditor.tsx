/**
 * SchematicEditor — main editing screen for a project (G1)
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────┐
 *  │  Top bar: back · project name · undo/redo · search  │
 *  ├──────────┬──────────────────────────────┬───────────┤
 *  │ Library  │  SchematicCanvas (React Flow) │Properties │
 *  │ Panel    │  FR-SE-01 to FR-SE-10         │Panel      │
 *  ├──────────┴──────────────────────────────┴───────────┤
 *  │  WireListPanel (FR-SN-02)                           │
 *  └─────────────────────────────────────────────────────┘
 *
 * FR-SE-09 / NFR-R-01: Auto-save via useEditorState + background worker.
 */

import { useCallback, useState, type FC } from 'react';
import type { Project, SearchResultKind } from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';
import { GlobalSearch } from '../components/GlobalSearch.js';
import { WireListPanel } from '../components/WireListPanel.js';
import { useEditorState } from './useEditorState.js';
import SchematicCanvas, { type CanvasSelection } from './canvas/SchematicCanvas.js';
import LibraryPanel from './LibraryPanel.js';
import PropertiesPanel from './PropertiesPanel.js';

interface Props {
  project: Project;
  storage: StorageAdapter;
  onClose: () => void;
}

export const SchematicEditor: FC<Props> = ({ project, storage, onClose }) => {
  const editor = useEditorState(project, storage);
  const { schematic, saving, saveError, undo, redo, canUndo, canRedo } = editor;

  const [selection, setSelection] = useState<CanvasSelection>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);

  // FR-SN-01: navigate canvas to a search result
  const handleNavigateTo = useCallback((kind: SearchResultKind, id: string) => {
    if (kind === 'wire') setSelectedWireId(id);
    if (kind === 'connector') setSelection({ kind: 'connector', id });
    else if (kind === 'wire') setSelection({ kind: 'wire', id });
  }, []);

  // Wire list row click
  const handleSelectWire = useCallback((wireId: string) => {
    setSelectedWireId(wireId);
    setSelection({ kind: 'wire', id: wireId });
  }, []);

  // Canvas selection change
  const handleSelectionChange = useCallback((sel: CanvasSelection) => {
    setSelection(sel);
    if (sel?.kind === 'wire') setSelectedWireId(sel.id);
    else if (!sel) setSelectedWireId(null);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#f8fafc',
        fontFamily: 'sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ── Top bar ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: '#1e293b',
          color: '#f1f5f9',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Back to projects"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '3px 5px',
            borderRadius: 4,
            fontSize: '1rem',
            lineHeight: 1,
          }}
          title="Back to projects"
        >
          ←
        </button>
        <span
          style={{
            fontWeight: 600,
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 180,
          }}
        >
          {project.meta.name}
        </span>

        {/* Undo / Redo — FR-SE-08 */}
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            style={{
              background: 'none',
              border: '1px solid #475569',
              color: canUndo ? '#f1f5f9' : '#475569',
              borderRadius: 4,
              padding: '2px 7px',
              fontSize: 12,
              cursor: canUndo ? 'pointer' : 'default',
            }}
          >
            ↩
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            style={{
              background: 'none',
              border: '1px solid #475569',
              color: canRedo ? '#f1f5f9' : '#475569',
              borderRadius: 4,
              padding: '2px 7px',
              fontSize: 12,
              cursor: canRedo ? 'pointer' : 'default',
            }}
          >
            ↪
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* FR-SN-01: Global search */}
        <GlobalSearch schematic={schematic} onNavigateTo={handleNavigateTo} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving && (
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Saving…</span>
          )}
          {saveError && (
            <span style={{ fontSize: '0.72rem', color: '#f87171' }} role="alert">
              {saveError}
            </span>
          )}
        </div>
      </header>

      {/* ── Middle row: Library | Canvas | Properties ── */}
      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Library panel (FR-SE-02, FR-CL-09) */}
        <LibraryPanel components={project.components} storage={storage} />

        {/* Canvas (FR-SE-01 through FR-SE-10, NFR-P-01) */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <SchematicCanvas
            schematic={schematic}
            project={project}
            editor={editor}
            onSelectionChange={handleSelectionChange}
          />
        </div>

        {/* Properties panel (FR-SE-06) */}
        <PropertiesPanel
          selection={selection}
          schematic={schematic}
          editor={editor}
        />
      </div>

      {/* ── Wire List Panel (FR-SN-02) ── */}
      <div
        style={{
          height: 240,
          flexShrink: 0,
          borderTop: '1px solid #cbd5e1',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <WireListPanel
          schematic={schematic}
          selectedWireId={selectedWireId}
          onSelectWire={handleSelectWire}
        />
      </div>
    </div>
  );
};

export default SchematicEditor;
