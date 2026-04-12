/**
 * LibraryPanel — left sidebar listing project components (FR-SE-02).
 *
 * Each component card is draggable; the SchematicCanvas handles the drop
 * to place a ConnectorInstance node.
 */

import { useState, type FC, type DragEvent } from 'react';
import type { Component } from '@kicable/shared';

interface Props {
  components: Component[];
}

const LibraryPanel: FC<Props> = ({ components }) => {
  const [query, setQuery] = useState('');

  const filtered = components.filter((c) => {
    const q = query.toLowerCase();
    return (
      !q ||
      c.partNumber.toLowerCase().includes(q) ||
      c.manufacturer.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  });

  function handleDragStart(e: DragEvent<HTMLDivElement>, comp: Component) {
    e.dataTransfer.setData('application/kicable-component', JSON.stringify(comp));
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div
      style={{
        width: 200,
        height: '100%',
        background: '#f8fafc',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '8px 10px 6px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f1f5f9',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
          LIBRARY
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter…"
          aria-label="Filter components"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '3px 6px',
            fontSize: 11,
            border: '1px solid #cbd5e1',
            borderRadius: 4,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {filtered.length === 0 && (
          <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 16 }}>
            {components.length === 0
              ? 'No components in project'
              : 'No matches'}
          </p>
        )}
        {filtered.map((comp) => (
          <div
            key={comp.id}
            draggable
            onDragStart={(e) => handleDragStart(e, comp)}
            title={`${comp.partNumber}\n${comp.description}\n${comp.pinCount} pins — drag onto canvas`}
            style={{
              padding: '5px 7px',
              marginBottom: 4,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              cursor: 'grab',
              fontSize: 11,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: '#1e293b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {comp.partNumber}
            </div>
            {comp.manufacturer && (
              <div style={{ color: '#64748b', fontSize: 10 }}>{comp.manufacturer}</div>
            )}
            <div style={{ color: '#94a3b8', fontSize: 10 }}>{comp.pinCount} pins</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LibraryPanel;
