/**
 * SchematicEditor — main editing screen for a project (G1)
 *
 * Layout:
 *  ┌────────────────────────────────────────────┐
 *  │  Top bar: project name  │  GlobalSearch     │
 *  ├────────────────────────────────────────────┤
 *  │  Canvas area (React Flow – §6.2 pending)   │
 *  ├────────────────────────────────────────────┤
 *  │  WireListPanel (FR-SN-02)                  │
 *  └────────────────────────────────────────────┘
 *
 * FR-SN-01: GlobalSearch navigates canvas to the selected entity.
 * FR-SN-02: WireListPanel supports live filter by any column.
 */

import { useCallback, useState, type FC } from 'react';
import type { Project, SearchResultKind } from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';
import { GlobalSearch } from '../components/GlobalSearch.js';
import { WireListPanel } from '../components/WireListPanel.js';
import { useSchematic } from './useSchematic.js';

interface Props {
  project: Project;
  storage: StorageAdapter;
  onClose: () => void;
}

/**
 * Canvas navigation target — set when the user selects a search result.
 * The canvas (React Flow, §6.2) will consume this to pan/zoom to the element.
 */
interface NavigationTarget {
  kind: SearchResultKind;
  id: string;
}

export const SchematicEditor: FC<Props> = ({ project, storage, onClose }) => {
  const {
    schematic,
    saving,
    saveError,
  } = useSchematic(project, storage);

  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [navTarget, setNavTarget] = useState<NavigationTarget | null>(null);

  /** FR-SN-01: navigate canvas to a search result */
  const handleNavigateTo = useCallback((kind: SearchResultKind, id: string) => {
    setNavTarget({ kind, id });
    // If the target is a wire, also sync the wire list selection
    if (kind === 'wire') setSelectedWireId(id);
  }, []);

  /** Wire list row click — select wire and request canvas highlight */
  const handleSelectWire = useCallback((wireId: string) => {
    setSelectedWireId(wireId);
    setNavTarget({ kind: 'wire', id: wireId });
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
          gap: 12,
          padding: '8px 14px',
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
            padding: '4px 6px',
            borderRadius: 4,
            fontSize: '1rem',
            lineHeight: 1,
          }}
          title="Back to projects"
        >
          ←
        </button>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
          {project.meta.name}
        </span>
        <div style={{ flex: 1 }} />

        {/* FR-SN-01: Global search */}
        <GlobalSearch schematic={schematic} onNavigateTo={handleNavigateTo} />

        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Saving…</span>
          )}
          {saveError && (
            <span style={{ fontSize: '0.75rem', color: '#f87171' }} role="alert">
              {saveError}
            </span>
          )}
        </div>
      </header>

      {/* ── Canvas area ── */}
      <div
        style={{
          flex: '1 1 0',
          minHeight: 0,
          position: 'relative',
          background: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        aria-label="Schematic canvas"
      >
        {/* Navigation target indicator — consumed by React Flow in §6.2 */}
        {navTarget && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#1e293b',
              color: '#f1f5f9',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: '0.8125rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            role="status"
          >
            <span>Navigating to <strong>{navTarget.kind}</strong> {navTarget.id.slice(0, 8)}…</span>
            <button
              onClick={() => setNavTarget(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block', margin: '0 auto 12px' }}>
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="10" y1="6.5" x2="14" y2="6.5" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="17.5" y1="10" x2="17.5" y2="14" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="6.5" y1="10" x2="6.5" y2="14" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="10" y1="17.5" x2="14" y2="17.5" stroke="#94a3b8" strokeWidth="1.5" />
          </svg>
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500 }}>Canvas (React Flow — §6.2)</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
            Drag connectors here · Draw wires between pins
          </p>
        </div>
      </div>

      {/* ── Wire List Panel (FR-SN-02) ── */}
      <div
        style={{
          height: 260,
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
