/**
 * ImageGallery — manage images attached to a component (FR-CL-07 – FR-CL-13)
 *
 * Features:
 *  FR-CL-07  File upload (JPEG, PNG, WebP, SVG; ≤ 20 MB)
 *  FR-CL-08  View type (front / rear / side / assembled / installed / datasheet_scan / other)
 *  FR-CL-09  Primary image designation (star button)
 *  FR-CL-10  Drag-to-reorder, rename filename, recategorize, delete
 *  FR-CL-11  Stored as ArrayBuffer — managed by useLibrary
 *  FR-CL-13  Blob key = component_id/image_id — managed by useLibrary
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FC,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import type { Component, ComponentImage } from '@kicable/shared';
import type { ComponentId, ImageId } from '@kicable/shared';
import type { UseLibraryReturn } from './useLibrary.js';

const VIEW_TYPES: ComponentImage['viewType'][] = [
  'front',
  'rear',
  'side',
  'assembled',
  'installed',
  'datasheet_scan',
  'other',
];

interface Props {
  component: Component;
  library: UseLibraryReturn;
}

export const ImageGallery: FC<Props> = ({ component, library }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadViewType, setUploadViewType] = useState<ComponentImage['viewType']>('front');
  const [error, setError] = useState<string | null>(null);
  // Map imageId → data URL for display
  const [dataUrls, setDataUrls] = useState<Map<string, string>>(new Map());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const compId = component.id as ComponentId;
  const images = [...component.images].sort((a, b) => a.sortOrder - b.sortOrder);

  // Load data URLs for all images
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      const entries: [string, string][] = [];
      for (const img of component.images) {
        const url = await library.getImageDataUrl(
          component.id as ComponentId,
          img.id as ImageId,
          img.mimeType,
        );
        if (url) entries.push([img.id, url]);
      }
      if (!cancelled) setDataUrls(new Map(entries));
    }
    void loadAll();
    return () => { cancelled = true; };
  }, [component.images, component.id, library]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError(null);
    setUploading(true);
    try {
      await library.addImage(compId, file, uploadViewType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSetPrimary(imageId: ImageId) {
    setError(null);
    try {
      await library.updateImage(compId, imageId, { isPrimary: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set primary');
    }
  }

  async function handleRename(imageId: ImageId, current: string) {
    const name = prompt('Rename image:', current);
    if (!name || name === current) return;
    setError(null);
    try {
      await library.updateImage(compId, imageId, { filename: name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    }
  }

  async function handleRecategorize(imageId: ImageId, value: string) {
    setError(null);
    try {
      await library.updateImage(compId, imageId, { viewType: value as ComponentImage['viewType'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recategorize failed');
    }
  }

  async function handleDelete(imageId: ImageId) {
    if (!confirm('Delete this image?')) return;
    setError(null);
    try {
      await library.deleteImage(compId, imageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  // Drag-to-reorder
  const handleDragStart = useCallback((e: DragEvent, imageId: string) => {
    setDraggingId(imageId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: DragEvent, imageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(imageId);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent, targetId: string) => {
      e.preventDefault();
      setDragOverId(null);
      if (!draggingId || draggingId === targetId) { setDraggingId(null); return; }

      const currentIds = images.map((img) => img.id);
      const fromIdx = currentIds.indexOf(draggingId);
      const toIdx = currentIds.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) { setDraggingId(null); return; }

      const reordered = [...currentIds];
      reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, draggingId);
      setDraggingId(null);

      try {
        await library.reorderImages(compId, reordered as ImageId[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Reorder failed');
      }
    },
    [draggingId, images, compId, library],
  );

  const s = {
    container: { fontFamily: 'sans-serif' } as React.CSSProperties,
    header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } as React.CSSProperties,
    uploadRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 } as React.CSSProperties,
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 } as React.CSSProperties,
    card: (isDragOver: boolean, isPrimary: boolean): React.CSSProperties => ({
      border: `2px solid ${isDragOver ? '#2563eb' : isPrimary ? '#f59e0b' : '#e2e8f0'}`,
      borderRadius: 6,
      overflow: 'hidden',
      background: '#fff',
      cursor: 'grab',
      opacity: draggingId === 'dragging' ? 0.5 : 1,
    }),
    img: { width: '100%', height: 80, objectFit: 'cover' as const, display: 'block', background: '#f8fafc' },
    meta: { padding: '4px 6px', fontSize: 10 } as React.CSSProperties,
    actions: { display: 'flex', gap: 2, padding: '0 4px 4px' } as React.CSSProperties,
    btn: (color?: string): React.CSSProperties => ({
      flex: 1,
      padding: '2px 0',
      fontSize: 10,
      border: '1px solid #e2e8f0',
      borderRadius: 3,
      cursor: 'pointer',
      background: color ?? '#fff',
      color: color ? '#fff' : '#374151',
    }),
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>Images</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{images.length} attached</span>
      </div>

      {/* Upload control */}
      <div style={s.uploadRow}>
        <select
          value={uploadViewType}
          onChange={(e) => setUploadViewType(e.target.value as ComponentImage['viewType'])}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4 }}
          aria-label="Image view type"
        >
          {VIEW_TYPES.map((vt) => <option key={vt} value={vt}>{vt.replace('_', ' ')}</option>)}
        </select>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '4px 12px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontSize: 12,
          }}
        >
          {uploading ? 'Uploading…' : '+ Add Image'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          onChange={(e) => void handleUpload(e)}
          style={{ display: 'none' }}
          aria-label="Upload component image"
        />
      </div>

      {error && (
        <div
          role="alert"
          style={{ padding: '5px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 12, marginBottom: 8 }}
        >
          {error}
        </div>
      )}

      {images.length === 0 && (
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: '12px 0' }}>
          No images attached yet.
        </p>
      )}

      <div style={s.grid}>
        {images.map((img) => {
          const dataUrl = dataUrls.get(img.id);
          const isDragOver = dragOverId === img.id;
          return (
            <div
              key={img.id}
              draggable
              onDragStart={(e) => handleDragStart(e, img.id)}
              onDragOver={(e) => handleDragOver(e, img.id)}
              onDrop={(e) => void handleDrop(e, img.id)}
              onDragLeave={() => setDragOverId(null)}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
              style={s.card(isDragOver, img.isPrimary)}
              title={`${img.filename} · ${img.viewType}${img.isPrimary ? ' · PRIMARY' : ''}`}
            >
              {dataUrl ? (
                <img src={dataUrl} alt={img.filename} style={s.img} />
              ) : (
                <div
                  style={{ ...s.img, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11 }}
                >
                  {img.mimeType.includes('svg') ? 'SVG' : '…'}
                </div>
              )}
              <div style={s.meta}>
                <div style={{ color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {img.isPrimary && <span style={{ color: '#f59e0b', marginRight: 2 }}>★</span>}
                  {img.filename}
                </div>
                <select
                  value={img.viewType}
                  onChange={(e) => void handleRecategorize(img.id as ImageId, e.target.value)}
                  style={{ fontSize: 10, width: '100%', border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer' }}
                  aria-label={`View type for ${img.filename}`}
                >
                  {VIEW_TYPES.map((vt) => <option key={vt} value={vt}>{vt.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div style={s.actions}>
                {!img.isPrimary && (
                  <button
                    type="button"
                    onClick={() => void handleSetPrimary(img.id as ImageId)}
                    style={s.btn()}
                    title="Set as primary"
                  >
                    ★
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleRename(img.id as ImageId, img.filename)}
                  style={s.btn()}
                  title="Rename"
                >
                  ✏
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(img.id as ImageId)}
                  style={s.btn('#ef4444')}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageGallery;
