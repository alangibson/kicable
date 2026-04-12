/**
 * LibraryPanel — left sidebar showing the global component library (FR-SE-02).
 *
 * Loads all components from storage so the user can search the full global
 * library and drag connectors onto the canvas. The canvas handles the drop
 * and copies the component into the project on first use.
 *
 * FR-CL-09: Primary image shown as thumbnail when available.
 */

import { useState, useEffect, type FC, type DragEvent } from 'react';
import type { Component } from '@kicable/shared';
import type { ComponentId, ImageId } from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';
import { imageBlobKey } from '@kicable/shared';

interface Props {
  storage: StorageAdapter;
}

async function loadPrimaryDataUrl(
  comp: Component,
  storage: StorageAdapter,
): Promise<string | null> {
  const primary = comp.images.find((img) => img.isPrimary) ?? comp.images[0];
  if (!primary) return null;
  const buf = await storage.getBlob(
    imageBlobKey(comp.id as ComponentId, primary.id as ImageId),
  );
  if (!buf) return null;
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `data:${primary.mimeType};base64,${b64}`;
}

const LibraryPanel: FC<Props> = ({ storage }) => {
  const [components, setComponents] = useState<Component[]>([]);
  const [query, setQuery] = useState('');
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());

  // Load global library
  useEffect(() => {
    void storage.listComponents().then(setComponents);
  }, [storage]);

  // Load thumbnails for components that have images
  useEffect(() => {
    let cancelled = false;
    async function loadThumbs() {
      const entries: [string, string][] = [];
      for (const comp of components) {
        if (comp.images.length > 0) {
          const url = await loadPrimaryDataUrl(comp, storage);
          if (url) entries.push([comp.id, url]);
        }
      }
      if (!cancelled) setThumbnails(new Map(entries));
    }
    void loadThumbs();
    return () => { cancelled = true; };
  }, [components, storage]);

  const filtered = components.filter((c) => {
    const q = query.toLowerCase();
    return (
      !q ||
      c.partNumber.toLowerCase().includes(q) ||
      c.manufacturer.toLowerCase().includes(q)
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
            {components.length === 0 ? 'No components in library' : 'No matches'}
          </p>
        )}
        {filtered.map((comp) => {
          const thumb = thumbnails.get(comp.id);
          return (
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
                display: 'flex',
                gap: 6,
                alignItems: 'flex-start',
              }}
            >
              {thumb && (
                <img
                  src={thumb}
                  alt={comp.partNumber}
                  style={{
                    width: 36,
                    height: 36,
                    objectFit: 'cover',
                    borderRadius: 3,
                    flexShrink: 0,
                    border: '1px solid #e2e8f0',
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LibraryPanel;
